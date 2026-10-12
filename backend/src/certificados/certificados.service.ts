import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import JSZip from 'jszip';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ESTADO_PROYECTO_FINALIZADO } from '../common/estados';
import {
  CAMPOS_POR_DEFECTO,
  normalizarCampos,
} from './campos-certificado';
import {
  CertificadoPdfService,
  DatosCertificado,
} from './certificado-pdf.service';
import { codigoVerificacion as codigoDeVerificacion } from './codigo-verificacion';
import { PlantillasService } from './plantillas.service';
import {
  CERTIFICADOS_DIR,
  direccionVerificacion,
} from './rutas-certificado';
import { EmitirCertificadosDto } from './dto/emitir-certificados.dto';
import { EnviarCertificadosDto } from './dto/enviar-certificado.dto';

/** Estado de un certificado anulado: se conserva, pero ya no vale. */
const ESTADO_EMITIDO = 'EMITIDO';
const ESTADO_ANULADO = 'ANULADO';

/**
 * Prefijo del folio: `CACE-2026-0001`.
 *
 * La CACE delante, el año de emisión en medio y un consecutivo de cuatro
 * dígitos. Se lee en voz alta por teléfono, ordena alfabéticamente igual que
 * numéricamente (por eso el relleno con ceros) y no lleva ni la institución ni
 * el proyecto: un certificado es de la CACE, y las dos instituciones y la clase
 * ya van impresas dentro.
 */
const PREFIJO_FOLIO = 'CACE';
const DIGITOS_FOLIO = 4;

const ETIQUETAS_ESTADO: Record<string, string> = {
  EN_PLANIFICACION: 'en planificación',
  EN_CURSO: 'en curso',
  FINALIZADO: 'finalizada',
  CANCELADO: 'cancelada',
};

/** Un certificado tal como se devuelve a la pantalla. */
export interface CertificadoVista {
  id: number;
  folio: string;
  alumnoId: number;
  alumnoNombre: string;
  matricula: string;
  correo: string;
  estado: string;
  emitidoEn: Date;
  anuladoMotivo: string;
  /** Cuándo se le envió por correo y a qué dirección (fase 5). */
  enviadoEn: Date | null;
  enviadoA: string;
  hashSha256: string;
  archivoPdf: string;
  /**
   * La dirección pública de este certificado **con su código**
   * (`/verificar/<folio>?c=<codigo>`), que es la misma que va dentro del QR.
   * El docente la copia desde la pantalla para pegarla donde le haga falta.
   */
  enlaceVerificacion: string;
  /** El código corto que exige la página pública, para poder dictarlo. */
  codigoVerificacion: string;
}

/** Una línea del resultado del envío por correo. */
interface EnvioCertificado {
  certificadoId: number;
  folio: string;
  alumno: string;
  correo: string;
  enviadoEn: Date;
}

/** Un certificado que no se envió, con el motivo (ya enviado, anulado…). */
interface EnvioOmitido {
  certificadoId: number;
  folio: string;
  alumno: string;
  motivo: string;
}

/** Un envío que el servidor de correo rechazó; el resto del lote sigue. */
interface EnvioFallido {
  certificadoId: number;
  folio: string;
  alumno: string;
  correo: string;
  motivo: string;
}

/**
 * Resultado de un envío, sea de uno o de todos. Siempre informa de **cuántos
 * salieron** y de qué pasó con los demás: un envío a varios alumnos no se cae
 * entero porque a uno le falte el correo o el servidor rechace su dirección.
 */
export interface ResultadoEnvio {
  mensaje: string;
  total: number;
  enviados: EnvioCertificado[];
  omitidos: EnvioOmitido[];
  fallidos: EnvioFallido[];
  sinCorreo: { certificadoId: number; folio: string; alumno: string }[];
}

/**
 * Emisión de certificados: quién puede, cuándo y con qué plantilla.
 *
 * Tres reglas que vienen del diseño y que este servicio hace cumplir:
 *
 * 1. **Solo con la clase espejo cerrada** (`FINALIZADO`). Antes, un mensaje que
 *    dice en qué estado está y qué falta.
 * 2. **Cada docente emite para los alumnos de su institución**, nunca para los
 *    de la otra. La lista es la de la fase 1 y se busca por (proyecto,
 *    institución), así que un alumno de la otra lista ni siquiera se encuentra.
 * 3. **El PDF se guarda tal como salió** (`uploads/certificados/<folio>.pdf`)
 *    con su `hashSha256`. Cambiar la plantilla después no toca lo ya emitido.
 *
 * Las descargas van siempre con sesión y comprobando la institución: los PDF
 * son documentos personales y no se sirven como archivos estáticos.
 */
@Injectable()
export class CertificadosService {
  private readonly logger = new Logger(CertificadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: CertificadoPdfService,
    private readonly plantillas: PlantillasService,
    private readonly mail: MailService,
  ) {
    // La carpeta tiene que existir antes de la primera emisión.
    mkdirSync(CERTIFICADOS_DIR, { recursive: true });
  }

  // --- Lectura: el estado de la sección ---

  /**
   * Lo que la pantalla necesita para pintarse: si la clase está cerrada, por
   * qué no se puede emitir, qué plantilla hay, qué alumnos entran y qué
   * certificados salieron ya.
   */
  async listar(usuarioId: number, proyectoId: number) {
    const { institucionId } = await this.contexto(usuarioId, proyectoId);

    const [proyecto, plantilla, lista] = await Promise.all([
      this.prisma.proyectoClaseEspejo.findUnique({
        where: { id: proyectoId },
        select: { id: true, estado: true },
      }),
      this.plantillas.activa(),
      this.prisma.listaAlumnos.findUnique({
        where: { proyectoId_institucionId: { proyectoId, institucionId } },
        include: { alumnos: { orderBy: { orden: 'asc' } } },
      }),
    ]);

    const certificados = await this.prisma.certificado.findMany({
      where: { proyectoId, alumno: { lista: { institucionId } } },
      include: { alumno: { select: { nombre: true, matricula: true, correo: true } } },
      orderBy: { emitidoEn: 'desc' },
    });

    const incluidos = (lista?.alumnos ?? []).filter((a) => a.incluido);
    const vigentes = certificados.filter((c) => c.estado === ESTADO_EMITIDO);
    const conCertificado = new Set(vigentes.map((c) => c.alumnoId));
    const pendientes = incluidos.filter((a) => !conCertificado.has(a.id));

    const claseCerrada = proyecto?.estado === ESTADO_PROYECTO_FINALIZADO;

    return {
      proyectoId,
      estadoProyecto: proyecto?.estado ?? '',
      claseCerrada,
      // El botón de emitir se deshabilita con esta explicación a la vista.
      motivoNoEmitir: this.motivoParaNoEmitir(
        claseCerrada,
        proyecto?.estado ?? '',
        plantilla,
        lista ? incluidos.length : null,
      ),
      plantilla: plantilla
        ? {
            id: plantilla.id,
            version: plantilla.version,
            fondoUrl: plantilla.fondoUrl,
          }
        : null,
      lista: lista
        ? {
            id: lista.id,
            total: lista.alumnos.length,
            incluidos: incluidos.length,
            sinCorreo: lista.alumnos.filter((a) => !a.correo).length,
            /**
             * Quiénes son los que no tienen correo, no solo cuántos: en la
             * pantalla hay que poder añadírselo uno por uno. Se listan los que
             * entran en los certificados, que son los que harán falta.
             */
            sinCorreoAlumnos: incluidos
              .filter((a) => !a.correo)
              .map((a) => ({ alumnoId: a.id, alumno: a.nombre })),
          }
        : null,
      certificados: certificados.map((c) => this.aVista(c)),
      resumen: {
        emitidos: vigentes.length,
        anulados: certificados.length - vigentes.length,
        pendientes: pendientes.length,
        alumnos: incluidos.length,
      },
    };
  }

  // --- Emisión ---

  /**
   * Emite uno o todos los certificados de la lista de la institución del
   * docente. Devuelve qué se emitió, qué se reemitió y qué se dejó pasar, con
   * el motivo: nunca falla entera porque un alumno ya tuviera certificado.
   */
  async emitir(usuarioId: number, proyectoId: number, dto: EmitirCertificadosDto) {
    const { institucionId } = await this.contexto(usuarioId, proyectoId);

    const proyecto = await this.proyectoParaCertificado(proyectoId);
    if (!proyecto) throw new NotFoundException('Esa clase espejo no existe.');
    if (proyecto.estado !== ESTADO_PROYECTO_FINALIZADO) {
      throw new BadRequestException(
        `Todavía no se pueden emitir los certificados: la clase espejo está ${ETIQUETAS_ESTADO[proyecto.estado] ?? proyecto.estado} y los certificados se emiten al cerrarla.`,
      );
    }

    const plantilla = await this.plantillas.activa();
    if (!plantilla) {
      throw new BadRequestException(
        'La presidencia de la CACE todavía no ha diseñado la plantilla del certificado. Sin plantilla no hay nada que imprimir.',
      );
    }

    const lista = await this.prisma.listaAlumnos.findUnique({
      where: { proyectoId_institucionId: { proyectoId, institucionId } },
      include: { alumnos: { orderBy: { orden: 'asc' } } },
    });
    if (!lista) {
      throw new BadRequestException(
        'Todavía no has subido la lista de tus alumnos en esta clase espejo: los certificados salen de esa lista.',
      );
    }

    // Solo los alumnos de **mi** lista y solo los que entran en los certificados.
    let alumnos = lista.alumnos.filter((a) => a.incluido);
    if (dto.alumnoId !== undefined) {
      alumnos = alumnos.filter((a) => a.id === dto.alumnoId);
      if (alumnos.length === 0) {
        throw new BadRequestException(
          'Ese alumno no está en la lista de tu institución (o lo dejaste fuera de los certificados).',
        );
      }
    }
    if (alumnos.length === 0) {
      throw new BadRequestException(
        'La lista no tiene ningún alumno incluido en los certificados.',
      );
    }

    const avisos: string[] = [];
    const emitidos: CertificadoVista[] = [];
    const reemitidos: CertificadoVista[] = [];
    const omitidos: { alumnoId: number; alumno: string; motivo: string }[] = [];

    for (const alumno of alumnos) {
      const anterior = await this.prisma.certificado.findFirst({
        where: {
          alumnoId: alumno.id,
          proyectoId,
          estado: ESTADO_EMITIDO,
        },
        orderBy: { emitidoEn: 'desc' },
      });

      if (anterior && !dto.reemitir) {
        omitidos.push({
          alumnoId: alumno.id,
          alumno: alumno.nombre,
          motivo: `Ya tiene el certificado ${anterior.folio}. Si hay que corregirlo, pide la reemisión.`,
        });
        continue;
      }

      const nuevo = await this.emitirUno({
        alumno,
        proyecto,
        plantilla,
        usuarioId,
        avisos,
      });

      if (anterior) {
        // El anterior se conserva, pero deja de valer: un alumno no puede
        // tener dos certificados vigentes del mismo curso.
        await this.prisma.certificado.update({
          where: { id: anterior.id },
          data: {
            estado: ESTADO_ANULADO,
            anuladoMotivo: `Reemitido con el folio ${nuevo.folio}`,
          },
        });
        reemitidos.push(nuevo);
      } else {
        emitidos.push(nuevo);
      }
    }

    return {
      mensaje: this.mensajeDeEmision(emitidos.length, reemitidos.length, omitidos.length),
      emitidos,
      reemitidos,
      omitidos,
      avisos,
    };
  }

  // --- Anulación (fase 5) ---

  /**
   * Anula un certificado con su motivo. El PDF **no se borra**: es un documento
   * histórico y el docente puede seguir descargándolo, pero deja de valer en la
   * página pública, que pasa a mostrarlo como anulado con esta explicación.
   *
   * Quién puede: el **docente** de la clase espejo, y solo para los certificados
   * de la lista de **su** institución (con `proyectoId`); o la **presidencia**,
   * que responde por lo que firma la CACE y puede anular cualquiera (sin
   * `proyectoId`, porque su panel no está dentro de una clase espejo).
   */
  async anular(entrada: {
    usuarioId: number;
    certificadoId: number;
    motivo: string;
    /** La clase espejo desde la que se anula (la ruta del docente). */
    proyectoId?: number;
  }) {
    const motivo = (entrada.motivo ?? '').trim();
    if (motivo.length < 3) {
      throw new BadRequestException(
        'El motivo de la anulación es obligatorio: hay que explicar por qué deja de valer el certificado.',
      );
    }

    const certificado = await this.prisma.certificado.findUnique({
      where: { id: entrada.certificadoId },
      include: {
        alumno: {
          select: {
            nombre: true,
            matricula: true,
            correo: true,
            lista: { select: { institucionId: true } },
          },
        },
      },
    });
    if (!certificado) {
      throw new NotFoundException('Ese certificado no existe.');
    }

    if (entrada.proyectoId !== undefined) {
      // Docente: tiene que participar en la clase y el certificado ser de la
      // lista de su institución. Si no, no se distingue de uno que no existe.
      const { institucionId } = await this.contexto(
        entrada.usuarioId,
        entrada.proyectoId,
        'Solo el docente de esta clase espejo puede anular los certificados de su institución. La presidencia de la CACE los anula desde su panel.',
      );
      const esDeSuLista =
        certificado.proyectoId === entrada.proyectoId &&
        certificado.alumno.lista.institucionId === institucionId;
      if (!esDeSuLista) {
        throw new NotFoundException(
          'Ese certificado no es de la lista de tu institución.',
        );
      }
    } else {
      await this.exigirPresidencia(entrada.usuarioId);
    }

    if (certificado.estado === ESTADO_ANULADO) {
      throw new BadRequestException(
        `El certificado ${certificado.folio} ya estaba anulado.`,
      );
    }

    const actualizado = await this.prisma.certificado.update({
      where: { id: certificado.id },
      data: { estado: ESTADO_ANULADO, anuladoMotivo: motivo },
      include: {
        alumno: { select: { nombre: true, matricula: true, correo: true } },
      },
    });

    return {
      mensaje: `El certificado ${actualizado.folio} quedó anulado. La página de verificación ya lo muestra como anulado con este motivo.`,
      certificado: this.aVista(actualizado),
    };
  }

  // --- Envío por correo a los alumnos (fase 5) ---

  /**
   * Envía el certificado a **todos** los alumnos de mi lista (o a los que se
   * indiquen en `alumnoIds`), uno por uno y con el PDF adjunto.
   *
   * Un lote no se cae entero porque a un alumno le falte el correo o porque el
   * servidor rechace su dirección: cada envío se intenta por separado y el
   * resultado dice cuántos salieron y qué pasó con el resto.
   */
  async enviar(
    usuarioId: number,
    proyectoId: number,
    dto: EnviarCertificadosDto,
  ): Promise<ResultadoEnvio> {
    const { institucionId } = await this.contexto(usuarioId, proyectoId);

    const certificados = await this.prisma.certificado.findMany({
      where: {
        proyectoId,
        alumno: {
          lista: { institucionId },
          ...(dto.alumnoIds && dto.alumnoIds.length > 0
            ? { id: { in: dto.alumnoIds } }
            : {}),
        },
      },
      include: {
        alumno: { select: { id: true, nombre: true, correo: true } },
      },
      orderBy: { folio: 'asc' },
    });

    if (certificados.length === 0) {
      throw new BadRequestException(
        dto.alumnoIds && dto.alumnoIds.length > 0
          ? 'Ninguno de los alumnos indicados tiene un certificado emitido en esta clase espejo.'
          : 'Todavía no hay certificados emitidos en la lista de tu institución que enviar.',
      );
    }

    return this.enviarLote(proyectoId, certificados, dto.reenviar === true);
  }

  /**
   * Envía el certificado de **un** alumno concreto.
   *
   * Un certificado anulado no se envía: no tendría sentido mandar por correo algo
   * que ya no vale. En el lote sí aparecen (como omitidos) porque el docente pidió
   * «a todos» y conviene que sepa que esos quedaron fuera.
   */
  async enviarUno(
    usuarioId: number,
    proyectoId: number,
    certificadoId: number,
    dto: EnviarCertificadosDto,
  ): Promise<ResultadoEnvio> {
    const certificado = await this.certificadoDeMiLista(
      usuarioId,
      proyectoId,
      certificadoId,
    );
    if (certificado.estado !== ESTADO_EMITIDO) {
      throw new BadRequestException(
        `El certificado ${certificado.folio} está anulado: no se le puede enviar al alumno.`,
      );
    }

    const completo = await this.prisma.certificado.findUnique({
      where: { id: certificado.id },
      include: { alumno: { select: { id: true, nombre: true, correo: true } } },
    });
    if (!completo) {
      throw new NotFoundException('Ese certificado no existe.');
    }

    return this.enviarLote(proyectoId, [completo], dto.reenviar === true);
  }

  /**
   * El envío, alumno por alumno.
   *
   * Se hace **de uno en uno** a propósito: el correo es lo único que el alumno
   * recibe, así que un fallo se anota y se sigue con el siguiente en vez de
   * abortar el lote. `enviadoEn` y `enviadoA` se guardan justo después de que el
   * servidor acepte el envío, que es lo que evita repetirlo por descuido.
   */
  private async enviarLote(
    proyectoId: number,
    certificados: {
      id: number;
      folio: string;
      archivoPdf: string;
      estado: string;
      enviadoEn: Date | null;
      enviadoA: string;
      alumno: { id: number; nombre: string; correo: string };
    }[],
    reenviar: boolean,
  ): Promise<ResultadoEnvio> {
    const clase = await this.datosDeLaClase(proyectoId);
    const resultado: Omit<ResultadoEnvio, 'mensaje' | 'total'> = {
      enviados: [],
      omitidos: [],
      fallidos: [],
      sinCorreo: [],
    };

    for (const certificado of certificados) {
      const folio = certificado.folio;
      const alumno = certificado.alumno.nombre;
      const correo = (certificado.alumno.correo ?? '').trim();

      if (certificado.estado !== ESTADO_EMITIDO) {
        resultado.omitidos.push({
          certificadoId: certificado.id,
          folio,
          alumno,
          motivo: 'El certificado está anulado.',
        });
        continue;
      }
      if (!correo) {
        resultado.sinCorreo.push({ certificadoId: certificado.id, folio, alumno });
        continue;
      }
      if (certificado.enviadoEn && !reenviar) {
        resultado.omitidos.push({
          certificadoId: certificado.id,
          folio,
          alumno,
          motivo: `Ya se le envió a ${certificado.enviadoA || correo}. Marca «reenviar» si quieres mandárselo otra vez.`,
        });
        continue;
      }

      const ruta = join(CERTIFICADOS_DIR, basename(certificado.archivoPdf));
      if (!existsSync(ruta)) {
        resultado.fallidos.push({
          certificadoId: certificado.id,
          folio,
          alumno,
          correo,
          motivo: 'El PDF del certificado no está en el servidor. Vuelve a emitirlo.',
        });
        continue;
      }

      try {
        await this.mail.sendCertificadoAlumno(correo, {
          alumno,
          titulo: clase.titulo,
          folio,
          instituciones: clase.instituciones,
          enlaceVerificacion: direccionVerificacion(folio),
          pdf: readFileSync(ruta),
          nombreArchivo: `certificado-${folio}.pdf`,
        });

        const enviadoEn = new Date();
        await this.prisma.certificado.update({
          where: { id: certificado.id },
          data: { enviadoEn, enviadoA: correo },
        });
        resultado.enviados.push({
          certificadoId: certificado.id,
          folio,
          alumno,
          correo,
          enviadoEn,
        });
      } catch (error) {
        // El detalle técnico va al registro; a la pantalla, algo que se entienda.
        this.logger.warn(
          `No se pudo enviar el certificado ${folio} a ${correo}: ${(error as Error)?.message ?? error}`,
        );
        resultado.fallidos.push({
          certificadoId: certificado.id,
          folio,
          alumno,
          correo,
          motivo: 'El servidor de correo no aceptó el envío.',
        });
      }
    }

    return {
      mensaje: this.mensajeDeEnvio(resultado),
      total: certificados.length,
      ...resultado,
    };
  }

  /**
   * La explicación del envío, con las cifras delante. Es lo que lee el docente:
   * «3 enviados, 1 sin correo, 1 falló».
   */
  private mensajeDeEnvio(resultado: {
    enviados: unknown[];
    omitidos: unknown[];
    fallidos: unknown[];
    sinCorreo: unknown[];
  }): string {
    const partes: string[] = [];
    partes.push(
      resultado.enviados.length === 1
        ? '1 certificado enviado por correo'
        : `${resultado.enviados.length} certificados enviados por correo`,
    );
    if (resultado.omitidos.length > 0) {
      partes.push(`${resultado.omitidos.length} sin enviar (ya se le había enviado)`);
    }
    if (resultado.sinCorreo.length > 0) {
      partes.push(`${resultado.sinCorreo.length} sin correo en la lista`);
    }
    if (resultado.fallidos.length > 0) {
      partes.push(`${resultado.fallidos.length} con error de envío`);
    }
    return `${partes.join(' · ')}.`;
  }

  /** El título de la clase y las dos instituciones, para el correo del alumno. */
  private async datosDeLaClase(proyectoId: number) {
    const proyecto = await this.prisma.proyectoClaseEspejo.findUnique({
      where: { id: proyectoId },
      select: {
        solicitud: {
          select: {
            titulo: true,
            asignacionOrigen: {
              select: {
                docenteInstitucion: {
                  select: { institucion: { select: { nombre: true } } },
                },
              },
            },
            institucionDestino: { select: { nombre: true } },
          },
        },
      },
    });

    const solicitud = proyecto?.solicitud;
    const origen =
      solicitud?.asignacionOrigen.docenteInstitucion.institucion.nombre ?? '';
    const destino = solicitud?.institucionDestino.nombre ?? '';
    return {
      titulo: solicitud?.titulo ?? 'Clase espejo',
      instituciones: [origen, destino].filter(Boolean).join(' · '),
    };
  }

  // --- Descargas (siempre con sesión) ---

  /** El PDF de un certificado concreto, comprobando que es de mi lista. */
  async descargar(usuarioId: number, proyectoId: number, certificadoId: number) {
    const certificado = await this.certificadoDeMiLista(
      usuarioId,
      proyectoId,
      certificadoId,
    );
    const ruta = join(CERTIFICADOS_DIR, basename(certificado.archivoPdf));
    if (!existsSync(ruta)) {
      throw new NotFoundException(
        'El archivo del certificado no está en el servidor. Vuelve a emitirlo.',
      );
    }
    return {
      nombre: `certificado-${certificado.folio}.pdf`,
      buffer: readFileSync(ruta),
    };
  }

  /**
   * Todos los certificados de mi lista en un ZIP, un PDF por alumno.
   *
   * Los anulados **no** entran: el ZIP es lo que se entrega a los alumnos, y
   * meter una versión anulada solo serviría para repartirla por error.
   */
  async zip(usuarioId: number, proyectoId: number) {
    const { institucionId } = await this.contexto(usuarioId, proyectoId);

    const certificados = await this.prisma.certificado.findMany({
      where: {
        proyectoId,
        estado: ESTADO_EMITIDO,
        alumno: { lista: { institucionId } },
      },
      orderBy: { folio: 'asc' },
    });
    if (certificados.length === 0) {
      throw new BadRequestException(
        'Todavía no hay certificados emitidos que descargar.',
      );
    }

    const zip = new JSZip();
    let incluidos = 0;
    for (const certificado of certificados) {
      const ruta = join(CERTIFICADOS_DIR, basename(certificado.archivoPdf));
      if (!existsSync(ruta)) continue;
      const alumno = await this.prisma.alumno.findUnique({
        where: { id: certificado.alumnoId },
        select: { nombre: true },
      });
      // El folio va delante para que el ZIP salga ordenado y no se repita un
      // nombre (dos alumnos que se llamen igual tendrían el mismo archivo).
      zip.file(
        `${certificado.folio} - ${this.nombreDeArchivo(alumno?.nombre ?? 'alumno')}.pdf`,
        readFileSync(ruta),
      );
      incluidos += 1;
    }

    if (incluidos === 0) {
      throw new NotFoundException(
        'No se encontró en el servidor ningún PDF de los certificados emitidos.',
      );
    }

    return {
      nombre: `certificados-clase-espejo-${proyectoId}.zip`,
      buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    };
  }

  // --- Piezas de la emisión ---

  /** Genera el PDF, lo archiva y guarda la fila del certificado. */
  private async emitirUno(entrada: {
    alumno: { id: number; nombre: string; matricula: string };
    proyecto: Awaited<ReturnType<CertificadosService['proyectoParaCertificado']>>;
    plantilla: NonNullable<Awaited<ReturnType<PlantillasService['activa']>>>;
    usuarioId: number;
    avisos: string[];
  }): Promise<CertificadoVista> {
    const { alumno, proyecto, plantilla, usuarioId, avisos } = entrada;
    if (!proyecto) throw new NotFoundException('Esa clase espejo no existe.');

    const datos: DatosCertificado = {
      folio: '',
      alumno: { nombre: alumno.nombre, matricula: alumno.matricula },
      plantilla: {
        version: plantilla.version,
        anchoPx: plantilla.anchoPx,
        altoPx: plantilla.altoPx,
        fondoUrl: plantilla.fondoUrl,
        // Se sanean aquí también: una fila editada a mano en la base no debe
        // poder romper la emisión. El lienzo es el de la propia plantilla, así
        // que un hueco medio fuera del papel se mete dentro antes de imprimir.
        campos: normalizarCampos(plantilla.campos, CAMPOS_POR_DEFECTO, {
          anchoPx: plantilla.anchoPx,
          altoPx: plantilla.altoPx,
        }),
      },
    };

    // El folio se pide antes de generar: va impreso dentro del PDF.
    const anio = new Date().getFullYear();
    for (let intento = 0; intento < 5; intento += 1) {
      const folio = await this.siguienteFolio(anio);
      datos.folio = folio;

      const { buffer, avisos: avisosPdf } = await this.pdf.generar(datos);
      for (const aviso of avisosPdf) {
        if (!avisos.includes(aviso)) avisos.push(aviso);
      }

      const archivo = `${folio}.pdf`;
      const ruta = join(CERTIFICADOS_DIR, archivo);
      writeFileSync(ruta, buffer);

      try {
        const guardado = await this.prisma.certificado.create({
          data: {
            folio,
            alumnoId: alumno.id,
            proyectoId: proyecto.id,
            plantillaId: plantilla.id,
            emitidoPorUsuarioId: usuarioId,
            archivoPdf: archivo,
            hashSha256: createHash('sha256').update(buffer).digest('hex'),
            estado: ESTADO_EMITIDO,
          },
          include: {
            alumno: { select: { nombre: true, matricula: true, correo: true } },
          },
        });
        return this.aVista(guardado);
      } catch (error) {
        this.borrarArchivo(ruta);
        // Choque de folio (dos emisiones a la vez): se reintenta con el
        // siguiente. Cualquier otro error sí tiene que salir.
        if (this.esFolioRepetido(error) && intento < 4) continue;
        throw error;
      }
    }

    throw new BadRequestException(
      'No se pudo asignar un folio único al certificado. Inténtalo de nuevo.',
    );
  }

  /**
   * El siguiente folio del año. Se mira el último guardado de ese año y se suma
   * uno; el `unique` de la columna es la red de seguridad si dos emisiones
   * coinciden (ver el reintento de `emitirUno`).
   */
  private async siguienteFolio(anio: number): Promise<string> {
    const prefijo = `${PREFIJO_FOLIO}-${anio}-`;
    const ultimo = await this.prisma.certificado.findFirst({
      where: { folio: { startsWith: prefijo } },
      orderBy: { folio: 'desc' },
      select: { folio: true },
    });
    const consecutivo = ultimo
      ? Number(ultimo.folio.slice(prefijo.length)) + 1
      : 1;
    return `${prefijo}${String(consecutivo).padStart(DIGITOS_FOLIO, '0')}`;
  }

  private esFolioRepetido(error: unknown): boolean {
    const codigo = (error as { code?: string })?.code;
    const meta = (error as { meta?: { target?: unknown } })?.meta;
    return (
      codigo === 'P2002' && JSON.stringify(meta?.target ?? '').includes('folio')
    );
  }

  private borrarArchivo(ruta: string): void {
    try {
      if (existsSync(ruta)) unlinkSync(ruta);
    } catch {
      this.logger.warn(`No se pudo borrar el PDF huérfano: ${ruta}`);
    }
  }

  // --- Apoyo ---

  /**
   * Comprueba que el usuario es docente de la clase espejo y devuelve su
   * institución. Es la misma regla que la lista de alumnos (fase 1): en una
   * clase espejo hay alumnos de los dos lados y cada docente responde por los
   * suyos.
   *
   * `aviso` deja cambiar el mensaje del 403: la anulación lo necesita, porque la
   * presidencia también puede anular (desde su panel) y su mensaje tiene que
   * decirle por dónde.
   */
  private async contexto(usuarioId: number, proyectoId: number, aviso?: string) {
    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
    });
    if (docente) {
      const participa = await this.prisma.proyectoDocente.findFirst({
        where: {
          proyectoId,
          asignacionDocente: { docenteInstitucion: { docenteId: docente.id } },
        },
        include: {
          asignacionDocente: { include: { docenteInstitucion: true } },
        },
      });
      if (participa) {
        return {
          docenteId: docente.id,
          institucionId:
            participa.asignacionDocente.docenteInstitucion.institucionId,
        };
      }
      throw new ForbiddenException(
        aviso ?? 'No participas en esta clase espejo.',
      );
    }
    throw new ForbiddenException(
      aviso ??
        'Solo el docente de la clase espejo puede emitir los certificados de sus alumnos.',
    );
  }

  /** El certificado, comprobando que el alumno es de la lista de mi institución. */
  private async certificadoDeMiLista(
    usuarioId: number,
    proyectoId: number,
    certificadoId: number,
  ) {
    const { institucionId } = await this.contexto(usuarioId, proyectoId);
    const certificado = await this.prisma.certificado.findFirst({
      where: {
        id: certificadoId,
        proyectoId,
        alumno: { lista: { proyectoId, institucionId } },
      },
    });
    if (!certificado) {
      throw new NotFoundException(
        'Ese certificado no es de la lista de tu institución.',
      );
    }
    return certificado;
  }

  /**
   * Lo que hace falta para imprimir un certificado de esta clase: el estado
   * (que decide si se puede emitir) y su identificador, que es lo que se guarda
   * en la fila del certificado. Los datos de la clase (título, instituciones,
   * fechas, docentes) van **dibujados dentro del diseño**, así que ya no hay
   * que traerlos de la base.
   */
  private async proyectoParaCertificado(proyectoId: number) {
    return this.prisma.proyectoClaseEspejo.findUnique({
      where: { id: proyectoId },
      select: { id: true, estado: true },
    });
  }

  /** La explicación que acompaña al botón deshabilitado. */
  private motivoParaNoEmitir(
    claseCerrada: boolean,
    estado: string,
    plantilla: { version: number } | null,
    alumnosIncluidos: number | null,
  ): string | null {
    if (!claseCerrada) {
      return `La clase espejo está ${ETIQUETAS_ESTADO[estado] ?? estado}. Los certificados se emiten al cerrarla.`;
    }
    if (!plantilla) {
      return 'La presidencia de la CACE todavía no ha diseñado la plantilla del certificado.';
    }
    if (alumnosIncluidos === null) {
      return 'Todavía no has subido la lista de tus alumnos en esta clase espejo.';
    }
    if (alumnosIncluidos === 0) {
      return 'Ningún alumno de tu lista entra en los certificados: revisa la columna «Certificado».';
    }
    return null;
  }

  private mensajeDeEmision(
    emitidos: number,
    reemitidos: number,
    omitidos: number,
  ): string {
    const partes: string[] = [];
    if (emitidos > 0) {
      partes.push(`${emitidos} certificado(s) emitido(s)`);
    }
    if (reemitidos > 0) {
      partes.push(`${reemitidos} reemitido(s) (el anterior quedó anulado)`);
    }
    if (omitidos > 0) {
      partes.push(`${omitidos} sin cambios`);
    }
    return partes.length > 0
      ? `${partes.join(', ')}.`
      : 'No había nada que emitir.';
  }

  /**
   * La anulación desde la presidencia, que no pasa por una clase espejo.
   *
   * El guardia ya pide la capacidad `anularCertificados`, pero se vuelve a
   * comprobar aquí que quien llama sea miembro activo de la CACE: una ruta que no
   * comprueba su propio ámbito depende de que nadie cambie la matriz de permisos
   * sin darse cuenta.
   */
  private async exigirPresidencia(usuarioId: number): Promise<void> {
    const miembro = await this.prisma.miembroCace.findUnique({
      where: { usuarioId },
      select: { activo: true },
    });
    if (!miembro?.activo) {
      throw new ForbiddenException(
        'Solo la presidencia de la CACE puede anular un certificado que no es de su clase espejo.',
      );
    }
  }

  /** De la fila de la base a lo que ve la pantalla. */
  private aVista(certificado: {
    id: number;
    folio: string;
    alumnoId: number;
    estado: string;
    emitidoEn: Date;
    anuladoMotivo: string;
    enviadoEn: Date | null;
    enviadoA: string;
    hashSha256: string;
    archivoPdf: string;
    alumno?: { nombre: string; matricula: string; correo: string } | null;
  }): CertificadoVista {
    return {
      id: certificado.id,
      folio: certificado.folio,
      alumnoId: certificado.alumnoId,
      alumnoNombre: certificado.alumno?.nombre ?? '',
      matricula: certificado.alumno?.matricula ?? '',
      correo: certificado.alumno?.correo ?? '',
      estado: certificado.estado,
      emitidoEn: certificado.emitidoEn,
      anuladoMotivo: certificado.anuladoMotivo,
      enviadoEn: certificado.enviadoEn,
      enviadoA: certificado.enviadoA,
      hashSha256: certificado.hashSha256,
      archivoPdf: certificado.archivoPdf,
      // El enlace y su código salen del folio: no se guardan en la base.
      enlaceVerificacion: direccionVerificacion(certificado.folio),
      codigoVerificacion: codigoDeVerificacion(certificado.folio),
    };
  }

  /** Nombre de archivo seguro para el ZIP (sin acentos ni signos raros). */
  private nombreDeArchivo(nombre: string): string {
    return nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ._-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }
}
