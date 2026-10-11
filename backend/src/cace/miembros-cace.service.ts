import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { resolverUrlPublica } from '../common/url-publica';
import { CARGO_SECRETARIA, CARGO_SUPLENTE } from '../common/estados';
import {
  generarDniUnico,
  generarPasswordProvisional,
} from './credenciales-cace';
import {
  ActualizarMiembroCaceDto,
  CrearMiembroCaceDto,
} from './dto/miembro-cace.dto';

/**
 * Miembros de la CACE vistos desde el panel del presidente (fase 6).
 *
 * El presidente reparte el trabajo dando de alta **secretarías**. Una secretaría
 * es una cuenta más de la plataforma con una fila en `MIEMBRO_CACE` y
 * `cargo = SECRETARIA`; sus capacidades están en `common/capacidades.ts` y no se
 * eligen aquí.
 *
 * Dos decisiones que se ven en el código:
 *
 * - **No se duplican personas**: si el correo ya es de un usuario de la
 *   plataforma, se le **añade** la fila de miembro en lugar de crear otra
 *   cuenta. Duplicar usuarios partiría en dos su historia y su contraseña.
 * - **Nadie se queda fuera de la CACE por descuido**: no se puede desactivar al
 *   último presidente activo ni uno mismo.
 */

/** Etiqueta del cargo, para los mensajes. */
const ETIQUETA_CARGO: Record<string, string> = {
  PRESIDENTE: 'Presidencia',
  SUPLENTE: 'Suplencia',
  SECRETARIA: 'Secretaría',
};

@Injectable()
export class MiembrosCaceService {
  private readonly logger = new Logger(MiembrosCaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Todos los miembros (presidencia, suplencia y secretarías), con la
   * presidencia primero: es el orden en el que se lee el panel.
   */
  async listar() {
    const miembros = await this.prisma.miembroCace.findMany({
      select: {
        id: true,
        cargo: true,
        activo: true,
        creadoEn: true,
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            correo: true,
            activo: true,
            debeCambiarPassword: true,
          },
        },
      },
      orderBy: [{ cargo: 'asc' }, { creadoEn: 'asc' }],
    });

    const orden: Record<string, number> = {
      PRESIDENTE: 0,
      SUPLENTE: 1,
      SECRETARIA: 2,
    };

    return miembros
      .map((miembro) => this.aFila(miembro))
      .sort(
        (a, b) =>
          (orden[a.cargo] ?? 9) - (orden[b.cargo] ?? 9) ||
          a.nombre.localeCompare(b.nombre, 'es'),
      );
  }

  /**
   * Alta de una secretaría. Crea la cuenta si el correo es nuevo y, si ya es de
   * un usuario de la plataforma, le añade el cargo sin tocarla (salvo
   * reactivarla si estaba desactivada, porque sin cuenta activa no podría
   * entrar).
   */
  async crear(usuarioId: number, dto: CrearMiembroCaceDto) {
    const correo = dto.correo.trim().toLowerCase();
    const nombres = dto.nombres.trim();
    const apellidoPaterno = dto.apellidoPaterno.trim();
    const apellidoMaterno = (dto.apellidoMaterno ?? '').trim();

    const existente = await this.prisma.usuario.findUnique({
      where: { correo },
      // El cliente omite `passwordHash`: aquí hace falta saber si tiene.
      omit: { passwordHash: false },
      include: { miembroCace: { select: { cargo: true, activo: true } } },
    });

    if (existente?.miembroCace) {
      // Un correo ya usado por la CACE no se vuelve a dar de alta: se activa
      // desde su ficha. El mensaje lo dice para que no se busque el problema.
      throw new ConflictException(
        `El correo ${correo} ya es de un miembro de la CACE (${this.etiquetaCargo(existente.miembroCace.cargo)}). ` +
          'Actívalo desde su ficha en vez de crearlo otra vez.',
      );
    }

    // Correo nuevo: cuenta con contraseña provisional y cambio obligatorio.
    if (!existente) {
      const passwordProvisional = generarPasswordProvisional();
      const passwordHash = await bcrypt.hash(passwordProvisional, 10);
      const dni = await generarDniUnico(this.prisma);

      const miembro = await this.prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.create({
          data: {
            nombres,
            apellidoPaterno,
            apellidoMaterno,
            dni,
            // "Otro" porque todavía no hay un documento real que guardar.
            tipoDocumento: 'Otro',
            correo,
            passwordHash,
            activo: true,
            debeCambiarPassword: true,
          },
        });

        return tx.miembroCace.create({
          data: {
            usuarioId: usuario.id,
            cargo: CARGO_SECRETARIA,
            activo: true,
          },
          select: {
            id: true,
            cargo: true,
            activo: true,
            creadoEn: true,
            usuario: {
              select: {
                id: true,
                nombres: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
                correo: true,
                activo: true,
                debeCambiarPassword: true,
              },
            },
          },
        });
      });

      const envio = await this.enviarCredenciales(correo, passwordProvisional);
      this.logger.log(
        `Secretaría de la CACE creada: ${correo} (la dio de alta el usuario ${usuarioId}).`,
      );

      return {
        mensaje: `Secretaría creada. Se enviaron las credenciales a ${correo}; entrará con una contraseña provisional que el sistema le pedirá cambiar.`,
        miembro: this.aFila(miembro),
        cuentaExistente: false,
        correoEnviado: envio.enviado,
        avisoCorreo: envio.aviso,
        // Solo cuando el correo no salió: sin esto, la contraseña no le llegaría
        // a nadie y la cuenta quedaría inaccesible.
        passwordProvisional: envio.enviado ? undefined : passwordProvisional,
      };
    }

    // Ya es usuario de la plataforma: se le añade el cargo, sin duplicarlo.
    const reactivarCuenta = !existente.activo;
    let passwordProvisional: string | null = null;
    if (!existente.passwordHash) {
      // Cuenta a medio crear (por ejemplo, alguien que quedó sin contraseña):
      // se le pone la provisional y el cambio obligatorio, igual que a una nueva.
      passwordProvisional = generarPasswordProvisional();
    }

    const miembro = await this.prisma.$transaction(async (tx) => {
      if (reactivarCuenta || passwordProvisional) {
        await tx.usuario.update({
          where: { id: existente.id },
          data: {
            ...(reactivarCuenta ? { activo: true } : {}),
            ...(passwordProvisional
              ? {
                  passwordHash: await bcrypt.hash(passwordProvisional, 10),
                  debeCambiarPassword: true,
                }
              : {}),
          },
        });
      }

      return tx.miembroCace.create({
        data: {
          usuarioId: existente.id,
          cargo: CARGO_SECRETARIA,
          activo: true,
        },
        select: {
          id: true,
          cargo: true,
          activo: true,
          creadoEn: true,
          usuario: {
            select: {
              id: true,
              nombres: true,
              apellidoPaterno: true,
              apellidoMaterno: true,
              correo: true,
              activo: true,
              debeCambiarPassword: true,
            },
          },
        },
      });
    });

    const envio = passwordProvisional
      ? await this.enviarCredenciales(correo, passwordProvisional)
      : { enviado: false, aviso: null };

    this.logger.log(
      `Cargo de secretaría añadido a la cuenta existente ${correo} (usuario ${usuarioId}).`,
    );

    return {
      mensaje:
        `La cuenta ${correo} ya existía: se le añadió el cargo de secretaría de la CACE.` +
        (reactivarCuenta
          ? ' Su cuenta estaba desactivada y se reactivó.'
          : '') +
        (passwordProvisional
          ? ' No tenía contraseña, así que se le mandó una provisional.'
          : ' Entra con la contraseña que ya tenía.'),
      miembro: this.aFila(miembro),
      cuentaExistente: true,
      correoEnviado: envio.enviado,
      avisoCorreo: envio.aviso,
      passwordProvisional: envio.enviado
        ? undefined
        : (passwordProvisional ?? undefined),
    };
  }

  /**
   * Activa o desactiva a un miembro. Desactivar **no** borra nada: apaga su
   * membresía, que es lo que el guardia mira para resolver el rol.
   */
  async cambiarActivo(
    usuarioId: number,
    miembroId: number,
    dto: ActualizarMiembroCaceDto,
  ) {
    const miembro = await this.prisma.miembroCace.findUnique({
      where: { id: miembroId },
      select: {
        id: true,
        usuarioId: true,
        cargo: true,
        activo: true,
        usuario: {
          select: {
            nombres: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            correo: true,
          },
        },
      },
    });
    if (!miembro) {
      throw new NotFoundException('Miembro de la CACE no encontrado');
    }

    const nombre = this.nombreCompleto(miembro.usuario);
    const activo = dto.activo !== false;
    const esPresidencia = miembro.cargo !== CARGO_SECRETARIA;

    if (!activo && esPresidencia) {
      // La CACE no se puede quedar sin presidencia activa: sin ella no hay
      // quien apruebe instituciones, autorice borrados ni firme certificados.
      // Es la comprobación que va primero porque, con una sola presidencia, es
      // también el motivo de que nadie pueda apagarse a sí mismo.
      const otrasPresidencias = await this.prisma.miembroCace.count({
        where: {
          activo: true,
          cargo: { in: ['PRESIDENTE', CARGO_SUPLENTE] },
          usuarioId: { not: miembro.usuarioId },
        },
      });
      if (otrasPresidencias === 0) {
        throw new BadRequestException(
          miembro.usuarioId === usuarioId
            ? 'Eres la última presidencia activa de la CACE: si desactivas tu cuenta, nadie podría aprobar instituciones, autorizar borrados ni firmar certificados. ' +
                'Da de alta antes a otro presidente o suplente.'
            : `«${nombre}» es la última presidencia activa de la CACE: si se desactiva, nadie podría aprobar instituciones, autorizar borrados ni firmar certificados. ` +
                'Da de alta antes a otro presidente o suplente.',
        );
      }
    }

    if (!activo && miembro.usuarioId === usuarioId) {
      // Con otra presidencia activa ya no hay excusa: apagarse a uno mismo
      // dejaría la CACE en manos de otro sin avisar.
      throw new BadRequestException(
        'No puedes desactivar tu propia cuenta de la CACE, aunque haya otra presidencia activa: pídeselo a otra persona de la presidencia.',
      );
    }

    const actualizado = await this.prisma.miembroCace.update({
      where: { id: miembroId },
      data: { activo },
      select: {
        id: true,
        cargo: true,
        activo: true,
        creadoEn: true,
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            correo: true,
            activo: true,
            debeCambiarPassword: true,
          },
        },
      },
    });

    return {
      mensaje: activo
        ? `${nombre} vuelve a ser ${this.etiquetaCargo(actualizado.cargo).toLowerCase()} de la CACE con acceso a su panel.`
        : `${nombre} deja de tener acceso como ${this.etiquetaCargo(actualizado.cargo).toLowerCase()} de la CACE. Su cuenta sigue existiendo y se puede volver a activar.`,
      miembro: this.aFila(actualizado),
    };
  }

  /**
   * Manda las credenciales provisionales. Si el correo falla, la contraseña se
   * escribe en el log y se devuelve al presidente: sin correo y sin contraseña,
   * la secretaría recién creada no podría entrar.
   */
  private async enviarCredenciales(
    correo: string,
    password: string,
  ): Promise<{ enviado: boolean; aviso: string | null }> {
    try {
      await this.mail.sendCredencialesSecretaria(
        correo,
        password,
        resolverUrlPublica(),
      );
      return { enviado: true, aviso: null };
    } catch (error) {
      this.logger.error(
        `No se pudieron enviar las credenciales de secretaría a ${correo}: ${this.mensajeDe(error)}`,
      );
      this.logger.warn(
        `Contraseña provisional de ${correo}: ${password} (el sistema pedirá cambiarla al entrar)`,
      );
      return {
        enviado: false,
        aviso:
          'No se pudo enviar el correo con las credenciales: la contraseña provisional va en esta respuesta para que se la puedas dar a mano.',
      };
    }
  }

  /** Fila del panel, ya con el nombre completo y la etiqueta del cargo. */
  private aFila(miembro: {
    id: number;
    cargo: string;
    activo: boolean;
    creadoEn: Date;
    usuario: {
      id: number;
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
      correo: string;
      activo: boolean;
      debeCambiarPassword: boolean;
    };
  }) {
    return {
      id: miembro.id,
      usuarioId: miembro.usuario.id,
      nombre: this.nombreCompleto(miembro.usuario),
      correo: miembro.usuario.correo,
      cargo: miembro.cargo,
      etiquetaCargo: this.etiquetaCargo(miembro.cargo),
      activo: miembro.activo,
      /** La cuenta puede entrar (una membresía activa con la cuenta apagada no sirve). */
      cuentaActiva: miembro.usuario.activo,
      debeCambiarPassword: miembro.usuario.debeCambiarPassword,
      creadoEn: miembro.creadoEn,
    };
  }

  private etiquetaCargo(cargo: string): string {
    return ETIQUETA_CARGO[cargo] ?? cargo;
  }

  private nombreCompleto(usuario: {
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
  }): string {
    return `${usuario.nombres} ${usuario.apellidoPaterno} ${usuario.apellidoMaterno}`.trim();
  }

  private mensajeDe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
