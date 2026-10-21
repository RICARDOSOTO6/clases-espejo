import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  ENVIOS_POR_TANDA,
  INTERVALO_WORKER_MS,
  MAX_INTENTOS_ENVIO,
  esperaReintentoMinutos,
} from './envios.constants';

/** Correo ya escrito, listo para guardarse en la cola. */
export interface CorreoEncolado {
  destinatario: string;
  asunto: string;
  texto: string;
  html: string;
  adjuntoNombre?: string;
  /** Ruta absoluta en disco (certificados). */
  adjuntoRuta?: string;
  /** Contenido en base64 (el `.ics`, que es pequeño). */
  adjuntoBase64?: string;
  certificadoId?: number;
}

export interface ResumenLote {
  loteId: string;
  total: number;
  pendientes: number;
  enviados: number;
  fallidos: number;
  completado: boolean;
  creadoEn: Date | null;
  errores: {
    destinatario: string;
    intentos: number;
    ultimoError: string;
    fallidoEn: Date | null;
  }[];
}

/**
 * Cola de correo (Fase 2).
 *
 * Los endpoints **solo encolan**: escriben una fila por destinatario y responden
 * con el `loteId`. Un worker periódico manda lo pendiente, reintenta con espera
 * creciente y apunta el motivo de cada fallo. Como la fila sigue `PENDIENTE`
 * hasta que el SMTP acepta el envío, matar el proceso a mitad no pierde correos:
 * la siguiente pasada los vuelve a intentar.
 *
 * La marca de «procesando» evita dos pasadas simultáneas dentro del mismo
 * proceso (el cron y una llamada manual, por ejemplo en las pruebas).
 */
@Injectable()
export class EnviosCorreoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EnviosCorreoService.name);
  private temporizador?: NodeJS.Timeout;
  private procesando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  onModuleInit(): void {
    // En pruebas no corre el reloj: las suites vacían la cola a mano para que el
    // resultado sea determinista.
    if (process.env.NODE_ENV === 'test' || INTERVALO_WORKER_MS <= 0) return;

    this.temporizador = setInterval(() => {
      void this.procesarPendientes();
    }, INTERVALO_WORKER_MS);
    this.temporizador.unref?.();
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  /** Guarda los correos como una sola tanda y devuelve su identificador. */
  async encolar(
    solicitadoPorUsuarioId: number,
    correos: CorreoEncolado[],
  ): Promise<{ loteId: string; total: number }> {
    if (correos.length === 0) {
      throw new BadRequestException('No hay correos que encolar.');
    }

    const loteId = randomUUID();
    await this.prisma.envioCorreo.createMany({
      data: correos.map((correo) => ({
        loteId,
        solicitadoPorUsuarioId,
        destinatario: correo.destinatario,
        asunto: correo.asunto,
        cuerpoTexto: correo.texto,
        cuerpoHtml: correo.html,
        adjuntoNombre: correo.adjuntoNombre ?? null,
        adjuntoRuta: correo.adjuntoRuta ?? null,
        adjuntoBase64: correo.adjuntoBase64 ?? null,
        certificadoId: correo.certificadoId ?? null,
      })),
    });

    return { loteId, total: correos.length };
  }

  /**
   * Progreso de un lote. Solo lo ve quien lo pidió: los correos llevan datos de
   * alumnos y no deben quedar visibles para cualquier sesión.
   */
  async progreso(loteId: string, usuarioId: number): Promise<ResumenLote> {
    const filas = await this.prisma.envioCorreo.findMany({
      where: { loteId },
      select: {
        solicitadoPorUsuarioId: true,
        destinatario: true,
        estado: true,
        intentos: true,
        ultimoError: true,
        fallidoEn: true,
        creadoEn: true,
      },
    });

    if (filas.length === 0) {
      throw new NotFoundException('Ese lote de envíos no existe.');
    }
    if (!filas.some((fila) => fila.solicitadoPorUsuarioId === usuarioId)) {
      throw new ForbiddenException('Ese lote de envíos no es tuyo.');
    }

    const pendientes = filas.filter((f) => f.estado === 'PENDIENTE').length;
    const enviados = filas.filter((f) => f.estado === 'ENVIADO').length;
    const fallidos = filas.filter((f) => f.estado === 'FALLIDO').length;
    const errores = filas
      .filter((f) => f.estado === 'FALLIDO')
      .map((f) => ({
        destinatario: f.destinatario,
        intentos: f.intentos,
        ultimoError: f.ultimoError,
        fallidoEn: f.fallidoEn,
      }));

    return {
      loteId,
      total: filas.length,
      pendientes,
      enviados,
      fallidos,
      completado: pendientes === 0,
      creadoEn: filas[0]?.creadoEn ?? null,
      errores,
    };
  }

  /**
   * Una pasada del worker: manda hasta `limite` correos vencidos.
   *
   * Es público para que las pruebas (y una persona con prisa) pueda vaciar la
   * cola sin esperar al reloj.
   */
  async procesarPendientes(limite = ENVIOS_POR_TANDA): Promise<{
    procesados: number;
    enviados: number;
    fallidos: number;
    pendientes: number;
  }> {
    if (this.procesando) {
      return this.contarPendientes().then((pendientes) => ({
        procesados: 0,
        enviados: 0,
        fallidos: 0,
        pendientes,
      }));
    }

    this.procesando = true;
    let enviados = 0;
    let fallidos = 0;
    let procesados = 0;

    try {
      const filas = await this.prisma.envioCorreo.findMany({
        where: { estado: 'PENDIENTE', proximoIntento: { lte: new Date() } },
        orderBy: [{ proximoIntento: 'asc' }, { creadoEn: 'asc' }],
        take: limite,
      });

      for (const fila of filas) {
        procesados += 1;
        const salio = await this.intentarEnviar(fila);
        if (salio) enviados += 1;
        else fallidos += 1;
      }
    } finally {
      this.procesando = false;
    }

    const pendientes = await this.contarPendientes();
    return { procesados, enviados, fallidos, pendientes };
  }

  private contarPendientes(): Promise<number> {
    return this.prisma.envioCorreo.count({ where: { estado: 'PENDIENTE' } });
  }

  /** Intenta un correo; devuelve si salió. Los fallos se anotan en la fila. */
  private async intentarEnviar(fila: {
    id: number;
    destinatario: string;
    asunto: string;
    cuerpoTexto: string;
    cuerpoHtml: string;
    adjuntoNombre: string | null;
    adjuntoRuta: string | null;
    adjuntoBase64: string | null;
    intentos: number;
    certificadoId: number | null;
  }): Promise<boolean> {
    try {
      const adjunto = this.adjuntoDe(fila);
      await this.mail.enviarCorreo(
        fila.destinatario,
        {
          asunto: fila.asunto,
          texto: fila.cuerpoTexto,
          html: fila.cuerpoHtml,
        },
        adjunto,
        // Los certificados pueden salir desde una dirección propia; el resto
        // (calendario, avisos) usa MAIL_FROM.
        fila.certificadoId !== null
          ? process.env.MAIL_FROM_CERTIFICADOS
          : undefined,
      );

      const enviadoEn = new Date();
      await this.prisma.$transaction(async (tx) => {
        await tx.envioCorreo.update({
          where: { id: fila.id },
          data: {
            estado: 'ENVIADO',
            enviadoEn,
            ultimoError: '',
          },
        });
        if (fila.certificadoId !== null) {
          await tx.certificado.update({
            where: { id: fila.certificadoId },
            data: { enviadoEn, enviadoA: fila.destinatario },
          });
        }
      });
      return true;
    } catch (error) {
      await this.registrarFallo(fila, error);
      return false;
    }
  }

  /**
   * Anota el fallo. Hasta `MAX_INTENTOS_ENVIO` la fila vuelve a la cola con una
   * espera mayor; después queda `FALLIDO` con el motivo, sin reintentos.
   */
  private async registrarFallo(
    fila: { id: number; destinatario: string; intentos: number },
    error: unknown,
  ): Promise<void> {
    const motivo = this.motivoDeFallo(error).slice(0, 500);
    const intentos = fila.intentos + 1;
    const ultimo = intentos >= MAX_INTENTOS_ENVIO;

    this.logger.warn(
      `No se pudo enviar a ${fila.destinatario} (intento ${intentos}/${MAX_INTENTOS_ENVIO}): ${motivo}`,
    );

    await this.prisma.envioCorreo.update({
      where: { id: fila.id },
      data: {
        intentos,
        ultimoError: motivo,
        ...(ultimo
          ? { estado: 'FALLIDO', fallidoEn: new Date() }
          : {
              proximoIntento: new Date(
                Date.now() + esperaReintentoMinutos(intentos) * 60_000,
              ),
            }),
      },
    });
  }

  /** Adjunto resuelto: por ruta (certificados) o desde base64 (calendario). */
  private adjuntoDe(fila: {
    adjuntoNombre: string | null;
    adjuntoRuta: string | null;
    adjuntoBase64: string | null;
  }): { nombre: string; contenido: Buffer; tipo: string } | undefined {
    if (!fila.adjuntoNombre) return undefined;
    const tipo = fila.adjuntoNombre.endsWith('.ics')
      ? 'text/calendar; charset=utf-8'
      : 'application/pdf';

    if (fila.adjuntoRuta) {
      if (!existsSync(fila.adjuntoRuta)) {
        throw new Error('El adjunto del correo ya no está en el servidor.');
      }
      return {
        nombre: fila.adjuntoNombre,
        contenido: readFileSync(fila.adjuntoRuta),
        tipo,
      };
    }

    if (fila.adjuntoBase64) {
      return {
        nombre: fila.adjuntoNombre,
        contenido: Buffer.from(fila.adjuntoBase64, 'base64'),
        tipo,
      };
    }

    throw new Error('El envío no tiene el contenido del adjunto.');
  }

  private motivoDeFallo(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Error desconocido al enviar el correo';
  }
}
