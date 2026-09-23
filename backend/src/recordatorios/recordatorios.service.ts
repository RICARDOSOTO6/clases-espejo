import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SolicitudesService } from '../solicitudes/solicitudes.service';
import {
  ESTADO_REPORTE_CONFIRMADO,
  ESTADO_SESION_CANCELADA,
  ESTADOS_PROYECTO_EDITABLES,
  ESTATUS_PENDIENTE,
} from '../common/estados';
import {
  diasHasta,
  urgenciaSegunDias,
  type Urgencia,
} from '../common/plazos';

/** Una solicitud con su plazo, tal como la pinta la agenda. */
export interface SolicitudAgenda {
  id: number;
  titulo: string;
  estado: string;
  fechaPropuesta: Date;
  fechaLimite: Date;
  diasRestantes: number;
  urgencia: Urgencia;
  /** Etapa que le toca ahora: respuesta del origen o confirmación del destino. */
  etapa: 'ORIGEN' | 'DESTINO';
  /** Si la siguiente decisión depende de la institución del usuario. */
  meToca: boolean;
  contraparte: string;
  docente: string;
}

/** Una clase espejo programada (una sesión) con los datos para el calendario. */
export interface ClaseAgenda {
  id: number;
  proyectoId: number;
  titulo: string;
  fechaHora: Date;
  estado: string;
  enlaceVirtual: string;
  contraparte: string;
}

/** Algo por hacer que no es una fecha límite de solicitud. */
export interface TareaAgenda {
  tipo: string;
  titulo: string;
  detalle: string;
  proyectoId: number;
  urgencia: Urgencia;
}

/**
 * Agenda del usuario: solicitudes por caducar, clases próximas y tareas
 * pendientes (firmas, confirmaciones y planificaciones sin aprobar).
 *
 * Antes de responder se comprueba el vencimiento de las solicitudes, así que la
 * información siempre está al día aunque el planificador no haya corrido.
 */
@Injectable()
export class RecordatoriosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly solicitudes: SolicitudesService,
  ) {}

  async obtener(usuarioId: number) {
    // El rol no es una columna: se deduce de la relación que exista.
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        agente: { select: { id: true, institucionId: true } },
        docente: { select: { id: true } },
      },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const caducadasAhora = await this.solicitudes.caducarVencidas();
    const esAgente = Boolean(usuario.agente);

    const solicitudes = esAgente
      ? await this.solicitudesParaAgente(usuarioId)
      : await this.solicitudesParaDocente(usuarioId);

    const clases = await this.clasesProximas(usuarioId, esAgente);
    const tareas = esAgente
      ? await this.tareasDeAgente(usuarioId)
      : await this.tareasDeDocente(usuarioId);

    const cuenta = (nivel: Urgencia) =>
      solicitudes.filter((s) => s.urgencia === nivel).length;

    return {
      generadoEn: new Date(),
      caducadasAhora,
      resumen: {
        vencidas: cuenta('VENCIDA'),
        criticas: cuenta('CRITICA'),
        proximas: cuenta('PROXIMA'),
        enRevision: solicitudes.length,
        clasesProximas: clases.length,
        tareas: tareas.length,
      },
      solicitudes,
      clases,
      tareas,
    };
  }

  // --- Solicitudes con plazo ---

  /** Docente: sus propias propuestas que siguen esperando respuesta. */
  private async solicitudesParaDocente(
    usuarioId: number,
  ): Promise<SolicitudAgenda[]> {
    const mias = await this.solicitudes.listarMias(usuarioId);
    return mias
      .filter((s) => s.enRevision)
      .map((s) => ({
        id: s.id,
        titulo: s.titulo,
        estado: s.estado,
        fechaPropuesta: s.fechaPropuesta,
        fechaLimite: s.fechaLimite,
        diasRestantes: s.diasRestantes,
        urgencia: s.urgencia,
        etapa: (s.estado === 'PENDIENTE' ? 'ORIGEN' : 'DESTINO') as
          | 'ORIGEN'
          | 'DESTINO',
        meToca: false,
        contraparte: s.institucionDestino?.nombre ?? '',
        docente: '',
      }))
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }

  /** Agente: lo que su institución todavía tiene que responder. */
  private async solicitudesParaAgente(
    usuarioId: number,
  ): Promise<SolicitudAgenda[]> {
    const agente = await this.prisma.agenteInternacionalizacion.findFirst({
      where: { usuarioId },
      select: { institucionId: true },
    });
    if (!agente) return [];

    const entrantes = await this.solicitudes.listarEntrantes(usuarioId);
    return entrantes
      .filter((s) => s.enRevision)
      .map((s) => {
        const etapa = s.estado === 'PENDIENTE' ? 'ORIGEN' : 'DESTINO';
        const meToca =
          etapa === 'ORIGEN'
            ? s.asignacionOrigen?.docenteInstitucion?.institucionId ===
              agente.institucionId
            : s.institucionDestino?.id === agente.institucionId;
        return {
          id: s.id,
          titulo: s.titulo,
          estado: s.estado,
          fechaPropuesta: s.fechaPropuesta,
          fechaLimite: s.fechaLimite,
          diasRestantes: s.diasRestantes,
          urgencia: s.urgencia,
          etapa: etapa as 'ORIGEN' | 'DESTINO',
          meToca,
          contraparte: s.institucionDestino?.nombre ?? '',
          docente: this.nombreDelDocenteOrigen(s),
        };
      })
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }

  private nombreDelDocenteOrigen(s: {
    asignacionOrigen?: {
      docenteInstitucion?: {
        docente?: {
          usuario?: {
            nombres?: string;
            apellidoPaterno?: string;
            apellidoMaterno?: string;
          };
        };
      };
    };
  }): string {
    const u = s.asignacionOrigen?.docenteInstitucion?.docente?.usuario;
    if (!u) return '';
    return `${u.nombres ?? ''} ${u.apellidoPaterno ?? ''} ${u.apellidoMaterno ?? ''}`.trim();
  }

  // --- Clases programadas ---

  /** Sesiones futuras de las clases espejo del usuario o de su institución. */
  private async clasesProximas(
    usuarioId: number,
    esAgente: boolean,
  ): Promise<ClaseAgenda[]> {
    const agente = esAgente
      ? await this.prisma.agenteInternacionalizacion.findFirst({
          where: { usuarioId },
          select: { institucionId: true },
        })
      : null;

    const sesiones = await this.prisma.sesion.findMany({
      where: {
        fechaHora: { gte: new Date() },
        estado: { not: ESTADO_SESION_CANCELADA },
        proyecto: esAgente
          ? {
              solicitud: {
                OR: [
                  { institucionDestinoId: agente?.institucionId ?? -1 },
                  {
                    asignacionOrigen: {
                      docenteInstitucion: {
                        institucionId: agente?.institucionId ?? -1,
                      },
                    },
                  },
                ],
              },
            }
          : {
              docentes: {
                some: {
                  asignacionDocente: {
                    docenteInstitucion: { docente: { usuarioId } },
                  },
                },
              },
            },
      },
      orderBy: { fechaHora: 'asc' },
      take: 40,
      include: {
        proyecto: {
          include: {
            solicitud: {
              include: {
                institucionDestino: true,
                asignacionOrigen: {
                  include: {
                    docenteInstitucion: { include: { institucion: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return sesiones.map((sesion) => ({
      id: sesion.id,
      proyectoId: sesion.proyectoId,
      titulo: sesion.titulo,
      fechaHora: sesion.fechaHora,
      estado: sesion.estado,
      enlaceVirtual: sesion.enlaceVirtual,
      contraparte: `${sesion.proyecto.solicitud.asignacionOrigen.docenteInstitucion.institucion.nombre} ↔ ${sesion.proyecto.solicitud.institucionDestino.nombre}`,
    }));
  }

  // --- Tareas (lo que falta hacer) ---

  /** Docente: firmas pendientes y confirmaciones de planificación. */
  private async tareasDeDocente(usuarioId: number): Promise<TareaAgenda[]> {
    const tareas: TareaAgenda[] = [];

    const reportes = await this.prisma.reporteClaseConjunta.findMany({
      where: {
        estado: { not: ESTADO_REPORTE_CONFIRMADO },
        sesion: {
          proyecto: {
            docentes: {
              some: {
                asignacionDocente: {
                  docenteInstitucion: { docente: { usuarioId } },
                },
              },
            },
          },
        },
      },
      orderBy: { creadoEn: 'asc' },
      take: 20,
      include: {
        sesion: {
          include: { proyecto: { include: { solicitud: true } } },
        },
        participaciones: {
          include: {
            proyectoDocente: {
              include: {
                asignacionDocente: {
                  include: { docenteInstitucion: { include: { docente: true } } },
                },
              },
            },
          },
        },
      },
    });

    for (const reporte of reportes) {
      const mia = reporte.participaciones.find(
        (p) =>
          p.proyectoDocente?.asignacionDocente?.docenteInstitucion?.docente
            ?.usuarioId === usuarioId,
      );
      const yaFirme = Boolean(mia?.confirmadoEn);
      const fecha = reporte.sesion.fechaHora;
      const dias = diasHasta(fecha);
      tareas.push({
        tipo: 'REPORTE',
        titulo: yaFirme
          ? `Reporte de «${reporte.sesion.titulo}» sin confirmar por el otro docente`
          : `Firma el reporte de «${reporte.sesion.titulo}»`,
        detalle: `La sesión fue el ${this.fechaCorta(fecha)}.`,
        proyectoId: reporte.sesion.proyectoId,
        urgencia: urgenciaSegunDias(dias, 0, 7),
      });
    }

    const participaciones = await this.prisma.participacionPlanificacion.findMany(
      {
        where: {
          estatusConfirmacion: ESTATUS_PENDIENTE,
          proyectoDocente: {
            asignacionDocente: {
              docenteInstitucion: { docente: { usuarioId } },
            },
          },
          planificacion: { proyecto: { estado: { in: ESTADOS_PROYECTO_EDITABLES } } },
        },
        take: 20,
        include: {
          planificacion: {
            include: {
              proyecto: { include: { solicitud: true } },
            },
          },
        },
      },
    );

    for (const participacion of participaciones) {
      const proyecto = participacion.planificacion.proyecto;
      const dias = diasHasta(proyecto.fechaInicio);
      tareas.push({
        tipo: 'PLANIFICACION',
        titulo: `Confirma tu participación en «${proyecto.solicitud.titulo}»`,
        detalle: `La clase empieza el ${this.fechaCorta(proyecto.fechaInicio)}.`,
        proyectoId: proyecto.id,
        urgencia: urgenciaSegunDias(dias, 3, 14),
      });
    }

    return tareas.sort(
      (a, b) => this.peso(a.urgencia) - this.peso(b.urgencia),
    );
  }

  /** Agente: clases de su institución cuya planificación sigue sin aprobarse. */
  private async tareasDeAgente(usuarioId: number): Promise<TareaAgenda[]> {
    const agente = await this.prisma.agenteInternacionalizacion.findFirst({
      where: { usuarioId },
      select: { institucionId: true },
    });
    if (!agente) return [];

    const proyectos = await this.prisma.proyectoClaseEspejo.findMany({
      where: {
        estado: 'EN_PLANIFICACION',
        solicitud: {
          OR: [
            { institucionDestinoId: agente.institucionId },
            {
              asignacionOrigen: {
                docenteInstitucion: { institucionId: agente.institucionId },
              },
            },
          ],
        },
      },
      take: 20,
      include: { solicitud: true, planificacion: true },
    });

    return proyectos
      .filter((p) => !p.planificacion || p.planificacion.estado !== 'APROBADA')
      .map((p) => {
        const dias = diasHasta(p.fechaInicio);
        return {
          tipo: 'PLANIFICACION',
          titulo: `La planificación de «${p.solicitud.titulo}» no está aprobada`,
          detalle: `La clase empieza el ${this.fechaCorta(p.fechaInicio)} y la planificación está ${this.etiquetaPlanificacion(p.planificacion?.estado)}.`,
          proyectoId: p.id,
          urgencia: urgenciaSegunDias(dias, 7, 21),
        };
      })
      .sort((a, b) => this.peso(a.urgencia) - this.peso(b.urgencia));
  }

  private peso(urgencia: Urgencia): number {
    return { VENCIDA: 0, CRITICA: 1, PROXIMA: 2, NORMAL: 3 }[urgencia];
  }

  private etiquetaPlanificacion(estado?: string): string {
    if (!estado) return 'sin crear';
    return (
      { BORRADOR: 'en borrador', EN_REVISION: 'en revisión', APROBADA: 'aprobada' }[
        estado
      ] ?? estado
    );
  }

  private fechaCorta(fecha: Date): string {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
