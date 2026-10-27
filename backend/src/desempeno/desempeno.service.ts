import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Contadores que alimentan el panel de desempeño.
 *
 * Se cuentan **participaciones**: una clase entre dos instituciones suma para
 * las dos, y una solicitud suma para la institución de origen y la de destino.
 * Es la lectura útil para acompañar a una universidad o a un docente; no es un
 * total contable de filas de la base.
 */
export interface ContadoresProyectos {
  total: number;
  finalizados: number;
  enCurso: number;
  enPlanificacion: number;
  cancelados: number;
  noConcluidos: number;
}

export interface ContadoresSolicitudes {
  total: number;
  aprobadas: number;
  pendientes: number;
  rechazadas: number;
  caducadas: number;
}

/** Datos de actividad que ya existen en la base y antes no se mostraban. */
export interface ContadoresActividad {
  sesiones: number;
  reportes: number;
  evidencias: number;
  certificados: number;
  evaluaciones: number;
}

export interface FilaDesempeno {
  id: number;
  nombre: string;
  detalle: string;
  logoUrl: string | null;
  proyectos: ContadoresProyectos;
  solicitudes: ContadoresSolicitudes;
  actividad: ContadoresActividad;
  /** Porcentaje entero, de 0 a 100. */
  tasaCierre: number;
  tasaRechazo: number;
  tasaReportes: number;
}

export interface ResumenDesempeno {
  proyectos: ContadoresProyectos;
  solicitudes: ContadoresSolicitudes;
  actividad: ContadoresActividad;
  tasaCierre: number;
  tasaRechazo: number;
}

export interface DesempenoCace {
  resumen: ResumenDesempeno;
  instituciones: FilaDesempeno[];
}

export interface DesempenoAgente {
  resumen: ResumenDesempeno;
  docentes: FilaDesempeno[];
}

type Contador = {
  proyectos: ContadoresProyectos;
  solicitudes: ContadoresSolicitudes;
  actividad: ContadoresActividad;
};

function contadoresVacios(): Contador {
  return {
    proyectos: {
      total: 0,
      finalizados: 0,
      enCurso: 0,
      enPlanificacion: 0,
      cancelados: 0,
      noConcluidos: 0,
    },
    solicitudes: {
      total: 0,
      aprobadas: 0,
      pendientes: 0,
      rechazadas: 0,
      caducadas: 0,
    },
    actividad: {
      sesiones: 0,
      reportes: 0,
      evidencias: 0,
      certificados: 0,
      evaluaciones: 0,
    },
  };
}

function sumarProyecto(contador: ContadoresProyectos, estado: string): void {
  contador.total += 1;
  switch (estado) {
    case 'FINALIZADO':
      contador.finalizados += 1;
      break;
    case 'EN_CURSO':
      contador.enCurso += 1;
      break;
    case 'EN_PLANIFICACION':
      contador.enPlanificacion += 1;
      break;
    case 'CANCELADO':
      contador.cancelados += 1;
      contador.noConcluidos += 1;
      break;
  }
}

function sumarActividad(
  contador: ContadoresActividad,
  proyecto: ProyectoBase,
): void {
  contador.sesiones += proyecto._count.sesiones;
  contador.reportes += proyecto.sesiones.filter((s) => !!s.reporte).length;
  contador.evidencias += proyecto._count.evidencias;
  contador.certificados += proyecto.certificados.length;
  contador.evaluaciones += proyecto._count.evaluaciones;
}

function sumarSolicitud(contador: ContadoresSolicitudes, estado: string): void {
  contador.total += 1;
  switch (estado) {
    case 'APROBADA':
    case 'APROBADA_POR_ORIGEN':
      contador.aprobadas += 1;
      break;
    case 'PENDIENTE':
      contador.pendientes += 1;
      break;
    case 'RECHAZADA':
      contador.rechazadas += 1;
      break;
    case 'CADUCADA':
      contador.caducadas += 1;
      break;
  }
}

function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

function tasaCierre(proyectos: ContadoresProyectos): number {
  return porcentaje(proyectos.finalizados, proyectos.total);
}

function tasaRechazo(solicitudes: ContadoresSolicitudes): number {
  return porcentaje(solicitudes.rechazadas, solicitudes.total);
}

function fila(
  id: number,
  nombre: string,
  detalle: string,
  logoUrl: string | null,
  contador: Contador,
): FilaDesempeno {
  return {
    id,
    nombre,
    detalle,
    logoUrl,
    proyectos: contador.proyectos,
    solicitudes: contador.solicitudes,
    actividad: contador.actividad,
    tasaCierre: tasaCierre(contador.proyectos),
    tasaRechazo: tasaRechazo(contador.solicitudes),
    tasaReportes: porcentaje(
      contador.actividad.reportes,
      contador.actividad.sesiones,
    ),
  };
}

type ProyectoBase = {
  estado: string;
  docentes: {
    asignacionDocente: {
      docenteInstitucion: { institucionId: number; docenteId: number };
    };
  }[];
  _count: {
    sesiones: number;
    evidencias: number;
    evaluaciones: number;
  };
  sesiones: { reporte: { id: number } | null }[];
  certificados: { id: number }[];
};

type SolicitudBase = {
  estado: string;
  institucionDestinoId: number;
  asignacionOrigen: {
    docenteInstitucion: { institucionId: number; docenteId: number };
  };
  asignacionDestino: {
    docenteInstitucion: { institucionId: number; docenteId: number };
  } | null;
};

@Injectable()
export class DesempenoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Métricas de todas las instituciones para la presidencia de la CACE. */
  async paraCace(): Promise<DesempenoCace> {
    const [instituciones, proyectos, solicitudes] = await Promise.all([
      this.prisma.institucion.findMany({
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, pais: true, logoUrl: true },
      }),
      this.prisma.proyectoClaseEspejo.findMany({
        select: {
          estado: true,
          docentes: {
            select: {
              asignacionDocente: {
                select: {
                  docenteInstitucion: {
                    select: { institucionId: true, docenteId: true },
                  },
                },
              },
            },
          },
          _count: {
            select: { sesiones: true, evidencias: true, evaluaciones: true },
          },
          sesiones: { select: { reporte: { select: { id: true } } } },
          certificados: { where: { estado: 'EMITIDO' }, select: { id: true } },
        },
      }),
      this.prisma.solicitudClaseEspejo.findMany({
        select: {
          estado: true,
          institucionDestinoId: true,
          asignacionOrigen: {
            select: {
              docenteInstitucion: {
                select: { institucionId: true, docenteId: true },
              },
            },
          },
          asignacionDestino: {
            select: {
              docenteInstitucion: {
                select: { institucionId: true, docenteId: true },
              },
            },
          },
        },
      }),
    ]);

    const porInstitucion = new Map<number, Contador>();
    for (const institucion of instituciones) {
      porInstitucion.set(institucion.id, contadoresVacios());
    }

    const resumen = contadoresVacios();
    for (const proyecto of proyectos as ProyectoBase[]) {
      sumarProyecto(resumen.proyectos, proyecto.estado);
      sumarActividad(resumen.actividad, proyecto);
      const ids = new Set(
        proyecto.docentes.map(
          (d) => d.asignacionDocente.docenteInstitucion.institucionId,
        ),
      );
      for (const id of ids) {
        const contador = porInstitucion.get(id);
        if (contador) {
          sumarProyecto(contador.proyectos, proyecto.estado);
          sumarActividad(contador.actividad, proyecto);
        }
      }
    }

    for (const solicitud of solicitudes as SolicitudBase[]) {
      sumarSolicitud(resumen.solicitudes, solicitud.estado);
      const ids = new Set<number>([
        solicitud.asignacionOrigen.docenteInstitucion.institucionId,
        solicitud.institucionDestinoId,
      ]);
      for (const id of ids) {
        const contador = porInstitucion.get(id);
        if (contador) sumarSolicitud(contador.solicitudes, solicitud.estado);
      }
    }

    return {
      resumen: {
        proyectos: resumen.proyectos,
        solicitudes: resumen.solicitudes,
        actividad: resumen.actividad,
        tasaCierre: tasaCierre(resumen.proyectos),
        tasaRechazo: tasaRechazo(resumen.solicitudes),
      },
      instituciones: instituciones.map((institucion) =>
        fila(
          institucion.id,
          institucion.nombre,
          institucion.pais,
          institucion.logoUrl,
          porInstitucion.get(institucion.id) ?? contadoresVacios(),
        ),
      ),
    };
  }

  /** Métricas de los docentes de la institución del agente autenticado. */
  async paraAgente(usuarioId: number): Promise<DesempenoAgente> {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
      select: {
        institucionId: true,
        institucion: { select: { nombre: true } },
      },
    });
    if (!agente) {
      throw new ForbiddenException('Solo un agente puede ver este panel.');
    }

    const docentes = await this.prisma.docenteInstitucion.findMany({
      where: { institucionId: agente.institucionId },
      orderBy: { docente: { usuario: { nombres: 'asc' } } },
      select: {
        docenteId: true,
        activo: true,
        docente: {
          select: {
            usuario: {
              select: {
                nombres: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
                correo: true,
              },
            },
          },
        },
      },
    });

    const docenteIds = docentes.map((d) => d.docenteId);
    const porDocente = new Map<number, Contador>();
    for (const docente of docentes) {
      porDocente.set(docente.docenteId, contadoresVacios());
    }

    if (docenteIds.length === 0) {
      return {
        resumen: {
          proyectos: contadoresVacios().proyectos,
          solicitudes: contadoresVacios().solicitudes,
          actividad: contadoresVacios().actividad,
          tasaCierre: 0,
          tasaRechazo: 0,
        },
        docentes: [],
      };
    }

    const [proyectos, solicitudes] = await Promise.all([
      this.prisma.proyectoClaseEspejo.findMany({
        where: {
          docentes: {
            some: {
              asignacionDocente: {
                docenteInstitucion: { docenteId: { in: docenteIds } },
              },
            },
          },
        },
        select: {
          estado: true,
          docentes: {
            select: {
              asignacionDocente: {
                select: {
                  docenteInstitucion: {
                    select: { institucionId: true, docenteId: true },
                  },
                },
              },
            },
          },
          _count: {
            select: { sesiones: true, evidencias: true, evaluaciones: true },
          },
          sesiones: { select: { reporte: { select: { id: true } } } },
          certificados: { where: { estado: 'EMITIDO' }, select: { id: true } },
        },
      }),
      this.prisma.solicitudClaseEspejo.findMany({
        where: {
          OR: [
            {
              asignacionOrigen: {
                docenteInstitucion: { docenteId: { in: docenteIds } },
              },
            },
            {
              asignacionDestino: {
                docenteInstitucion: { docenteId: { in: docenteIds } },
              },
            },
          ],
        },
        select: {
          estado: true,
          institucionDestinoId: true,
          asignacionOrigen: {
            select: {
              docenteInstitucion: {
                select: { institucionId: true, docenteId: true },
              },
            },
          },
          asignacionDestino: {
            select: {
              docenteInstitucion: {
                select: { institucionId: true, docenteId: true },
              },
            },
          },
        },
      }),
    ]);

    const resumen = contadoresVacios();
    for (const proyecto of proyectos as ProyectoBase[]) {
      sumarProyecto(resumen.proyectos, proyecto.estado);
      sumarActividad(resumen.actividad, proyecto);
      const ids = new Set(
        proyecto.docentes.map(
          (d) => d.asignacionDocente.docenteInstitucion.docenteId,
        ),
      );
      for (const id of ids) {
        const contador = porDocente.get(id);
        if (contador) {
          sumarProyecto(contador.proyectos, proyecto.estado);
          sumarActividad(contador.actividad, proyecto);
        }
      }
    }

    for (const solicitud of solicitudes as SolicitudBase[]) {
      sumarSolicitud(resumen.solicitudes, solicitud.estado);
      const ids = new Set<number>([
        solicitud.asignacionOrigen.docenteInstitucion.docenteId,
      ]);
      const destino = solicitud.asignacionDestino?.docenteInstitucion.docenteId;
      if (destino !== undefined) ids.add(destino);
      for (const id of ids) {
        const contador = porDocente.get(id);
        if (contador) sumarSolicitud(contador.solicitudes, solicitud.estado);
      }
    }

    return {
      resumen: {
        proyectos: resumen.proyectos,
        solicitudes: resumen.solicitudes,
        actividad: resumen.actividad,
        tasaCierre: tasaCierre(resumen.proyectos),
        tasaRechazo: tasaRechazo(resumen.solicitudes),
      },
      docentes: docentes.map((docente) => {
        const usuario = docente.docente.usuario;
        const nombre =
          `${usuario.nombres} ${usuario.apellidoPaterno} ${usuario.apellidoMaterno}`.trim();
        return fila(
          docente.docenteId,
          nombre,
          docente.activo ? agente.institucion.nombre : 'Inactivo',
          null,
          porDocente.get(docente.docenteId) ?? contadoresVacios(),
        );
      }),
    };
  }
}
