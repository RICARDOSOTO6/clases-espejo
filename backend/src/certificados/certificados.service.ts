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
import { ESTADO_PROYECTO_FINALIZADO } from '../common/estados';
import {
  normalizarCampos,
  normalizarTextosLegales,
} from './campos-certificado';
import {
  CertificadoPdfService,
  DatosCertificado,
} from './certificado-pdf.service';
import { PlantillasService } from './plantillas.service';
import { CERTIFICADOS_DIR } from './rutas-certificado';
import { EmitirCertificadosDto } from './dto/emitir-certificados.dto';

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
  /** Para la fase 5 (envío por correo): todavía no se rellena. */
  enviadoEn: Date | null;
  enviadoA: string;
  hashSha256: string;
  archivoPdf: string;
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
            firmaNombre: plantilla.firmaNombre,
            fondoUrl: plantilla.fondoUrl,
          }
        : null,
      lista: lista
        ? {
            id: lista.id,
            total: lista.alumnos.length,
            incluidos: incluidos.length,
            sinCorreo: lista.alumnos.filter((a) => !a.correo).length,
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

    const s = proyecto.solicitud;
    const origen = s?.asignacionOrigen?.docenteInstitucion?.institucion;
    const destino = s?.institucionDestino;

    const datos: DatosCertificado = {
      folio: '',
      alumno: { nombre: alumno.nombre, matricula: alumno.matricula },
      clase: {
        titulo: s?.titulo ?? `Clase espejo #${proyecto.id}`,
        plataforma: proyecto.plataforma,
        fechaInicio: proyecto.fechaInicio,
        fechaFin: proyecto.fechaFin,
      },
      instituciones: {
        origen: {
          nombre: origen?.nombre ?? 'Institución de origen',
          pais: origen?.pais ?? '',
        },
        destino: {
          nombre: destino?.nombre ?? 'Institución de destino',
          pais: destino?.pais ?? '',
        },
      },
      docentes: this.docentesDe(proyecto),
      plantilla: {
        version: plantilla.version,
        anchoPx: plantilla.anchoPx,
        altoPx: plantilla.altoPx,
        fondoUrl: plantilla.fondoUrl,
        // Se sanean aquí también: una fila editada a mano en la base no debe
        // poder romper la emisión.
        campos: normalizarCampos(plantilla.campos),
        textosLegales: normalizarTextosLegales(plantilla.textosLegales),
        firmaNombre: plantilla.firmaNombre,
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
   */
  private async contexto(usuarioId: number, proyectoId: number) {
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
      throw new ForbiddenException('No participas en esta clase espejo.');
    }
    throw new ForbiddenException(
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

  /** Todo lo que hace falta para imprimir un certificado de esta clase. */
  private async proyectoParaCertificado(proyectoId: number) {
    return this.prisma.proyectoClaseEspejo.findUnique({
      where: { id: proyectoId },
      include: {
        solicitud: {
          include: {
            asignacionOrigen: {
              include: {
                materia: true,
                docenteInstitucion: {
                  include: {
                    institucion: true,
                    docente: { include: { usuario: true } },
                  },
                },
              },
            },
            asignacionDestino: {
              include: {
                materia: true,
                docenteInstitucion: {
                  include: {
                    institucion: true,
                    docente: { include: { usuario: true } },
                  },
                },
              },
            },
            institucionDestino: true,
          },
        },
        docentes: {
          include: {
            asignacionDocente: {
              include: {
                docenteInstitucion: {
                  include: {
                    institucion: true,
                    docente: { include: { usuario: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /** Los docentes participantes, sin repetir a quien ya salió. */
  private docentesDe(proyecto: {
    docentes: {
      rol: string;
      asignacionDocente: {
        docenteInstitucion: {
          institucion: { nombre: string; pais: string };
          docente: {
            usuario: {
              nombres: string;
              apellidoPaterno: string;
              apellidoMaterno: string | null;
            };
          };
        };
      };
    }[];
  }) {
    const vistos = new Set<string>();
    const salida: {
      nombre: string;
      institucion: string;
      pais: string;
      rol: string;
    }[] = [];

    for (const pd of proyecto.docentes ?? []) {
      const di = pd.asignacionDocente?.docenteInstitucion;
      const u = di?.docente?.usuario;
      if (!u) continue;
      const nombre = `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno ?? ''}`
        .replace(/\s+/g, ' ')
        .trim();
      if (vistos.has(nombre)) continue;
      vistos.add(nombre);
      salida.push({
        nombre,
        institucion: di.institucion?.nombre ?? '',
        pais: di.institucion?.pais ?? '',
        rol: pd.rol,
      });
    }
    return salida;
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
