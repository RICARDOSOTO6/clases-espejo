import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { resolverUrlPublica } from '../common/url-publica';

/**
 * Alfabeto de la contraseña provisional. Se dejan fuera los pares que se
 * confunden al copiarlos de un correo (0/O, 1/l/I): el presidente la va a
 * transcribir a mano una sola vez, y un carácter ambiguo es un acceso fallido.
 */
const ALFABETO_PROVISIONAL =
  'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_PASSWORD = 12;

/**
 * Alta automática de la presidencia de la CACE (fase 0).
 *
 * La plataforma no puede depender de que el presidente se registre a mano: al
 * arrancar, si no existe ningún miembro con cargo PRESIDENTE y hay
 * `PRESIDENTE_CORREO`, se le deja la cuenta lista y se le manda su contraseña
 * provisional. Si ya hay presidencia, no se toca nada.
 */
@Injectable()
export class CaceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Punto de entrada del arranque. Nunca propaga el error: un problema con la
   * base o con el correo no puede impedir que el servidor levante (el resto de
   * la plataforma funciona sin presidente).
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.asegurarPresidente();
    } catch (error) {
      this.logger.error(
        `No se pudo dar de alta a la presidencia de la CACE: ${this.mensajeDe(error)}`,
      );
    }
  }

  /** Deja creada la presidencia si falta y le comunica sus credenciales. */
  private async asegurarPresidente(): Promise<void> {
    const correo = (process.env.PRESIDENTE_CORREO ?? '').trim();
    if (!correo) {
      this.logger.log(
        'Sin PRESIDENTE_CORREO: no se da de alta a la presidencia de la CACE.',
      );
      return;
    }

    const presidencia = await this.prisma.miembroCace.findFirst({
      where: { cargo: 'PRESIDENTE' },
      select: { id: true },
    });
    // Ya hay presidencia: ni se crea nada ni se manda ningún correo.
    if (presidencia) return;

    const { passwordProvisional, creada } = await this.asegurarCuenta(correo);

    if (!passwordProvisional) {
      // La cuenta ya existía con contraseña propia: la persona entra con ella y
      // solo se le añadió el cargo. Mandarle una contraseña nueva sería mentirle.
      this.logger.log(
        `La cuenta ${correo} ya existía con contraseña: se le añadió el cargo de presidencia de la CACE.`,
      );
      return;
    }

    this.logger.log(
      creada
        ? `Cuenta de presidencia de la CACE creada para ${correo}.`
        : `La cuenta ${correo} no tenía contraseña: se le puso la provisional y el cargo de presidencia.`,
    );
    await this.enviarCredenciales(correo, passwordProvisional);
  }

  /**
   * Deja lista la cuenta del presidente: crea el usuario si no existe o le
   * completa lo que falte, y le añade su fila en MIEMBRO_CACE.
   *
   * Devuelve la contraseña provisional **solo** cuando hay que comunicársela
   * (es decir, cuando se acaba de fijar); si la cuenta ya tenía contraseña,
   * devuelve null porque no hay ninguna novedad que mandar.
   */
  private async asegurarCuenta(
    correo: string,
  ): Promise<{ passwordProvisional: string | null; creada: boolean }> {
    const existente = await this.prisma.usuario.findUnique({
      where: { correo },
      // El cliente omite `passwordHash`: aquí hace falta saber si tiene.
      omit: { passwordHash: false },
    });

    if (existente?.passwordHash) {
      await this.prisma.miembroCace.create({
        data: { usuarioId: existente.id, cargo: 'PRESIDENTE', activo: true },
      });
      return { passwordProvisional: null, creada: false };
    }

    const password = this.generarPasswordProvisional();
    const passwordHash = await bcrypt.hash(password, 10);

    if (existente) {
      // Cuenta a medio crear (por ejemplo alguien que quedó sin contraseña): se
      // completa y se le marca el cambio obligatorio, igual que a una nueva.
      await this.prisma.$transaction([
        this.prisma.usuario.update({
          where: { id: existente.id },
          data: { passwordHash, debeCambiarPassword: true },
        }),
        this.prisma.miembroCace.create({
          data: { usuarioId: existente.id, cargo: 'PRESIDENTE', activo: true },
        }),
      ]);
      return { passwordProvisional: password, creada: false };
    }

    await this.prisma.$transaction(async (tx) => {
      // Datos provisionales: el presidente los corrige en su perfil al entrar.
      // `tipoDocumento` "Otro" porque todavía no hay DNI real que guardar.
      const usuario = await tx.usuario.create({
        data: {
          nombres: 'Presidente',
          apellidoPaterno: 'CACE',
          apellidoMaterno: '',
          dni: await this.generarDniUnico(),
          tipoDocumento: 'Otro',
          correo,
          passwordHash,
          activo: true,
          debeCambiarPassword: true,
        },
      });

      await tx.miembroCace.create({
        data: { usuarioId: usuario.id, cargo: 'PRESIDENTE', activo: true },
      });
    });

    return { passwordProvisional: password, creada: true };
  }

  /**
   * Manda las credenciales por correo. Si el envío falla, la contraseña
   * provisional se escribe en el log: sin correo y sin contraseña, la
   * presidencia quedaría fuera de la plataforma.
   */
  private async enviarCredenciales(
    correo: string,
    password: string,
  ): Promise<void> {
    try {
      await this.mail.sendCredencialesPresidente(
        correo,
        password,
        resolverUrlPublica(),
      );
      this.logger.log(`Credenciales de presidencia enviadas a ${correo}.`);
    } catch (error) {
      this.logger.error(
        `No se pudieron enviar las credenciales a ${correo}: ${this.mensajeDe(error)}`,
      );
      this.logger.warn(
        `Contraseña provisional de ${correo}: ${password} (el sistema pedirá cambiarla al entrar)`,
      );
    }
  }

  /**
   * Contraseña provisional de 12 caracteres. `randomInt` es criptográfico: una
   * contraseña adivinable sería una puerta abierta a la presidencia.
   */
  private generarPasswordProvisional(): string {
    let password = '';
    for (let i = 0; i < LARGO_PASSWORD; i++) {
      password += ALFABETO_PROVISIONAL[randomInt(ALFABETO_PROVISIONAL.length)];
    }
    return password;
  }

  /**
   * DNI provisional único: la columna es única y no admite vacíos, y todavía no
   * hay un documento real que guardar. Se comprueba contra la base para que un
   * choque no rompa el alta.
   */
  private async generarDniUnico(): Promise<string> {
    for (let intento = 0; intento < 5; intento++) {
      const dni = `CACE-${randomInt(100000, 999999)}`;
      const ocupado = await this.prisma.usuario.findUnique({
        where: { dni },
        select: { id: true },
      });
      if (!ocupado) return dni;
    }
    // Con 900 000 combinaciones, cinco choques seguidos ya no es mala suerte.
    return `CACE-${Date.now()}`;
  }

  private mensajeDe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
