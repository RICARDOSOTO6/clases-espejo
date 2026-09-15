import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { CreateProyectoDocenteDto } from './dto/create-proyecto-docente.dto';
import { SavePlanificacionDto } from './dto/save-planificacion.dto';
import { CreateReportePlanificacionDto } from './dto/create-reporte-planificacion.dto';
import { CreateMensajeDto } from './dto/create-mensaje.dto';
import { CreateSesionDto } from './dto/create-sesion.dto';
import { UpdateSesionDto } from './dto/update-sesion.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';

const ESTADO_PLANIFICACION_INICIAL = 'BORRADOR';
const ESTATUS_PENDIENTE = 'PENDIENTE';
const ESTATUS_CONFIRMADA = 'CONFIRMADA';

/** Proyección mínima necesaria para comprobar el acceso a un proyecto. */
interface ProyectoAccesible {
  solicitud: {
    institucionDestinoId: number;
    asignacionOrigen: {
      docenteInstitucion: { institucionId: number };
    };
  };
  docentes: {
    asignacionDocente: {
      docenteInstitucion: { docenteId: number };
    };
  }[];
}

@Injectable()
export class ProyectosService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Listados ---

  async listarParaDocente(usuarioId: number) {
    const docente = await this.getDocente(usuarioId);
    return this.prisma.proyectoClaseEspejo.findMany({
      where: {
        docentes: {
          some: {
            asignacionDocente: {
              docenteInstitucion: { docenteId: docente.id },
            },
          },
        },
      },
      include: this.includeProyecto(),
      orderBy: { creadoEn: 'desc' },
    });
  }

  async listarParaAgente(usuarioId: number) {
    const agente = await this.getAgente(usuarioId);
    return this.prisma.proyectoClaseEspejo.findMany({
      where: {
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
      include: this.includeProyecto(),
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtener(usuarioId: number, id: number) {
    const proyecto = await this.prisma.proyectoClaseEspejo.findUnique({
      where: { id },
      include: this.includeProyecto(),
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    await this.verificarAcceso(usuarioId, proyecto);
    return proyecto;
  }

  // --- Proyecto ---

  async actualizar(usuarioId: number, id: number, dto: UpdateProyectoDto) {
    await this.obtenerConAcceso(usuarioId, id);
    await this.exigirDocenteParticipante(usuarioId, id);

    return this.prisma.proyectoClaseEspejo.update({
      where: { id },
      data: {
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        ...(dto.fechaInicio !== undefined
          ? { fechaInicio: new Date(dto.fechaInicio) }
          : {}),
        ...(dto.fechaFin !== undefined
          ? { fechaFin: new Date(dto.fechaFin) }
          : {}),
        ...(dto.plataforma !== undefined
          ? { plataforma: dto.plataforma }
          : {}),
      },
      include: this.includeProyecto(),
    });
  }

  // --- Docentes del proyecto ---

  async agregarDocente(
    usuarioId: number,
    id: number,
    dto: CreateProyectoDocenteDto,
  ) {
    const proyecto = await this.obtenerConAcceso(usuarioId, id);
    const agente = await this.exigirAgenteInvolucrado(usuarioId, proyecto);

    const asignacion = await this.prisma.asignacionDocente.findUnique({
      where: { id: dto.asignacionDocenteId },
      include: { docenteInstitucion: true },
    });
    if (!asignacion) {
      throw new NotFoundException('La asignación indicada no existe');
    }

    // El agente solo puede sumar docentes de su propia institución.
    if (asignacion.docenteInstitucion.institucionId !== agente.institucionId) {
      throw new ForbiddenException(
        'Solo puedes gestionar docentes de tu institución',
      );
    }

    const duplicado = await this.prisma.proyectoDocente.findFirst({
      where: { proyectoId: id, asignacionDocenteId: dto.asignacionDocenteId },
    });
    if (duplicado) {
      throw new BadRequestException('El docente ya participa en el proyecto');
    }

    const creado = await this.prisma.proyectoDocente.create({
      data: {
        proyectoId: id,
        asignacionDocenteId: dto.asignacionDocenteId,
        rol: dto.rol,
      },
    });

    if (proyecto.planificacion) {
      await this.prisma.participacionPlanificacion.create({
        data: {
          planificacionId: proyecto.planificacion.id,
          proyectoDocenteId: creado.id,
          estatusConfirmacion: ESTATUS_PENDIENTE,
        },
      });
    }

    return this.obtener(usuarioId, id);
  }

  async quitarDocente(
    usuarioId: number,
    id: number,
    proyectoDocenteId: number,
  ) {
    const proyecto = await this.obtenerConAcceso(usuarioId, id);
    const agente = await this.exigirAgenteInvolucrado(usuarioId, proyecto);

    const participacion = await this.prisma.proyectoDocente.findFirst({
      where: { id: proyectoDocenteId, proyectoId: id },
      include: {
        proyecto: true,
        asignacionDocente: { include: { docenteInstitucion: true } },
      },
    });
    if (!participacion) {
      throw new NotFoundException('El docente no participa en este proyecto');
    }
    // El agente solo puede retirar docentes de su propia institución.
    if (
      participacion.asignacionDocente.docenteInstitucion.institucionId !==
      agente.institucionId
    ) {
      throw new ForbiddenException(
        'Solo puedes gestionar docentes de tu institución',
      );
    }
    if (participacion.proyecto.solicitudId === proyecto.solicitud.id) {
      const total = await this.prisma.proyectoDocente.count({
        where: { proyectoId: id },
      });
      if (total <= 1) {
        throw new BadRequestException(
          'El proyecto debe conservar al menos un docente',
        );
      }
    }

    await this.prisma.proyectoDocente.delete({
      where: { id: proyectoDocenteId },
    });
    return this.obtener(usuarioId, id);
  }

  // --- Planificación conjunta ---

  async guardarPlanificacion(
    usuarioId: number,
    id: number,
    dto: SavePlanificacionDto,
  ) {
    await this.obtenerConAcceso(usuarioId, id);
    await this.exigirDocenteParticipante(usuarioId, id);

    const planificacion = await this.prisma.planificacionConjunta.upsert({
      where: { proyectoId: id },
      create: {
        proyectoId: id,
        objetivosAcordados: dto.objetivosAcordados,
        temasAcordados: dto.temasAcordados,
        metodologia: dto.metodologia,
        plataforma: dto.plataforma,
        estado: dto.estado ?? ESTADO_PLANIFICACION_INICIAL,
      },
      update: {
        objetivosAcordados: dto.objetivosAcordados,
        temasAcordados: dto.temasAcordados,
        metodologia: dto.metodologia,
        plataforma: dto.plataforma,
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
      },
    });

    await this.sincronizarParticipaciones(planificacion.id, id);

    return this.prisma.planificacionConjunta.findUniqueOrThrow({
      where: { id: planificacion.id },
      include: this.includePlanificacion(),
    });
  }

  async confirmarParticipacion(usuarioId: number, id: number) {
    const proyecto = await this.obtenerConAcceso(usuarioId, id);
    if (!proyecto.planificacion) {
      throw new BadRequestException('Aún no existe una planificación conjunta');
    }

    const docente = await this.getDocente(usuarioId);
    const proyectoDocente = await this.prisma.proyectoDocente.findFirst({
      where: {
        proyectoId: id,
        asignacionDocente: {
          docenteInstitucion: { docenteId: docente.id },
        },
      },
    });
    if (!proyectoDocente) {
      throw new ForbiddenException('No participas en este proyecto');
    }

    const participacion = await this.prisma.participacionPlanificacion.findFirst(
      {
        where: {
          planificacionId: proyecto.planificacion.id,
          proyectoDocenteId: proyectoDocente.id,
        },
      },
    );
    if (!participacion) {
      throw new NotFoundException('Participación no encontrada');
    }

    await this.prisma.participacionPlanificacion.update({
      where: { id: participacion.id },
      data: {
        estatusConfirmacion: ESTATUS_CONFIRMADA,
        confirmadaEn: new Date(),
      },
    });

    return this.prisma.planificacionConjunta.findUniqueOrThrow({
      where: { id: proyecto.planificacion.id },
      include: this.includePlanificacion(),
    });
  }

  // --- Reporte de planificación ---

  async listarReportes(usuarioId: number, id: number) {
    const proyecto = await this.obtenerConAcceso(usuarioId, id);
    if (!proyecto.planificacion) return [];
    return this.prisma.reportePlanificacion.findMany({
      where: { planificacionId: proyecto.planificacion.id },
      orderBy: { generadoEn: 'desc' },
    });
  }

  async generarReporte(
    usuarioId: number,
    id: number,
    dto: CreateReportePlanificacionDto,
  ) {
    const proyecto = await this.obtenerConAcceso(usuarioId, id);
    await this.exigirAgenteInvolucrado(usuarioId, proyecto);

    if (!proyecto.planificacion) {
      throw new BadRequestException(
        'Aún no existe una planificación conjunta que reportar',
      );
    }

    return this.prisma.reportePlanificacion.create({
      data: {
        planificacionId: proyecto.planificacion.id,
        acuerdos: dto.acuerdos,
        calendario: dto.calendario,
        actividadesAcordadas: dto.actividadesAcordadas,
        generadoEn: new Date(),
      },
    });
  }

  // --- Chat del proyecto ---

  async listarMensajes(usuarioId: number, id: number) {
    await this.obtenerConAcceso(usuarioId, id);
    return this.prisma.mensaje.findMany({
      where: { proyectoId: id },
      include: this.includeMensaje(),
      orderBy: { creadoEn: 'asc' },
    });
  }

  async enviarMensaje(usuarioId: number, id: number, dto: CreateMensajeDto) {
    await this.obtenerConAcceso(usuarioId, id);
    const docente = await this.getDocente(usuarioId);

    const proyectoDocente = await this.prisma.proyectoDocente.findFirst({
      where: {
        proyectoId: id,
        asignacionDocente: { docenteInstitucion: { docenteId: docente.id } },
      },
    });
    if (!proyectoDocente) {
      throw new ForbiddenException('No participas en este proyecto');
    }

    return this.prisma.mensaje.create({
      data: {
        proyectoId: id,
        proyectoDocenteId: proyectoDocente.id,
        contenido: dto.contenido.trim(),
      },
      include: this.includeMensaje(),
    });
  }

  // --- Sesiones (Semana 6) ---

  async listarSesiones(usuarioId: number, id: number) {
    await this.obtenerConAcceso(usuarioId, id);
    return this.prisma.sesion.findMany({
      where: { proyectoId: id },
      orderBy: { fechaHora: 'asc' },
    });
  }

  async crearSesion(usuarioId: number, id: number, dto: CreateSesionDto) {
    await this.obtenerConAcceso(usuarioId, id);
    await this.exigirDocenteParticipante(usuarioId, id);
    return this.prisma.sesion.create({
      data: {
        proyectoId: id,
        titulo: dto.titulo,
        fechaHora: new Date(dto.fechaHora),
        enlaceVirtual: dto.enlaceVirtual,
        estado: dto.estado ?? 'PROGRAMADA',
      },
    });
  }

  async actualizarSesion(
    usuarioId: number,
    id: number,
    sesionId: number,
    dto: UpdateSesionDto,
  ) {
    await this.obtenerConAcceso(usuarioId, id);
    await this.exigirDocenteParticipante(usuarioId, id);
    const sesion = await this.prisma.sesion.findFirst({
      where: { id: sesionId, proyectoId: id },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    return this.prisma.sesion.update({
      where: { id: sesionId },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.fechaHora !== undefined
          ? { fechaHora: new Date(dto.fechaHora) }
          : {}),
        ...(dto.enlaceVirtual !== undefined
          ? { enlaceVirtual: dto.enlaceVirtual }
          : {}),
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
      },
    });
  }

  async eliminarSesion(usuarioId: number, id: number, sesionId: number) {
    await this.obtenerConAcceso(usuarioId, id);
    await this.exigirDocenteParticipante(usuarioId, id);
    const sesion = await this.prisma.sesion.findFirst({
      where: { id: sesionId, proyectoId: id },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    await this.prisma.sesion.delete({ where: { id: sesionId } });
    return { mensaje: 'Sesión eliminada' };
  }

  // --- Actividades (Semana 6) ---

  async listarActividades(usuarioId: number, id: number) {
    await this.obtenerConAcceso(usuarioId, id);
    return this.prisma.actividad.findMany({
      where: { proyectoId: id },
      orderBy: { fechaLimite: 'asc' },
    });
  }

  async crearActividad(usuarioId: number, id: number, dto: CreateActividadDto) {
    await this.obtenerConAcceso(usuarioId, id);
    await this.exigirDocenteParticipante(usuarioId, id);
    return this.prisma.actividad.create({
      data: {
        proyectoId: id,
        titulo: dto.titulo,
        instrucciones: dto.instrucciones,
        fechaLimite: new Date(dto.fechaLimite),
      },
    });
  }

  async actualizarActividad(
    usuarioId: number,
    id: number,
    actividadId: number,
    dto: UpdateActividadDto,
  ) {
    await this.obtenerConAcceso(usuarioId, id);
    await this.exigirDocenteParticipante(usuarioId, id);
    const actividad = await this.prisma.actividad.findFirst({
      where: { id: actividadId, proyectoId: id },
    });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    return this.prisma.actividad.update({
      where: { id: actividadId },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.instrucciones !== undefined
          ? { instrucciones: dto.instrucciones }
          : {}),
        ...(dto.fechaLimite !== undefined
          ? { fechaLimite: new Date(dto.fechaLimite) }
          : {}),
      },
    });
  }

  async eliminarActividad(usuarioId: number, id: number, actividadId: number) {
    await this.obtenerConAcceso(usuarioId, id);
    await this.exigirDocenteParticipante(usuarioId, id);
    const actividad = await this.prisma.actividad.findFirst({
      where: { id: actividadId, proyectoId: id },
    });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    await this.prisma.actividad.delete({ where: { id: actividadId } });
    return { mensaje: 'Actividad eliminada' };
  }

  // --- Evidencias (Semana 6) ---

  async listarEvidencias(usuarioId: number, id: number) {
    await this.obtenerConAcceso(usuarioId, id);
    return this.prisma.evidencia.findMany({
      where: { proyectoId: id },
      orderBy: { registradaEn: 'desc' },
    });
  }

  async crearEvidencia(
    usuarioId: number,
    id: number,
    dto: CreateEvidenciaDto,
    archivo?: any,
  ) {
    await this.obtenerConAcceso(usuarioId, id);
    await this.exigirDocenteParticipante(usuarioId, id);
    if (!archivo) {
      throw new BadRequestException('Debes adjuntar un archivo de evidencia');
    }
    const tipo = dto.tipo?.trim() || 'Archivo';
    return this.prisma.evidencia.create({
      data: {
        proyectoId: id,
        tipo,
        archivoUrl: `/uploads/${archivo.filename}`,
        sesionId: null,
        registradaEn: new Date(),
      },
    });
  }

  // --- Helpers ---

  private includeMensaje() {
    return {
      autor: {
        include: {
          asignacionDocente: {
            include: {
              docenteInstitucion: {
                include: { docente: { include: { usuario: true } } },
              },
            },
          },
        },
      },
    };
  }

  private async sincronizarParticipaciones(
    planificacionId: number,
    proyectoId: number,
  ): Promise<void> {
    const docentes = await this.prisma.proyectoDocente.findMany({
      where: { proyectoId },
    });
    const existentes = await this.prisma.participacionPlanificacion.findMany({
      where: { planificacionId },
    });
    const faltantes = docentes.filter(
      (d) => !existentes.some((e) => e.proyectoDocenteId === d.id),
    );
    if (faltantes.length === 0) return;

    await this.prisma.participacionPlanificacion.createMany({
      data: faltantes.map((d) => ({
        planificacionId,
        proyectoDocenteId: d.id,
        estatusConfirmacion: ESTATUS_PENDIENTE,
      })),
    });
  }

  private async obtenerConAcceso(usuarioId: number, id: number) {
    const proyecto = await this.prisma.proyectoClaseEspejo.findUnique({
      where: { id },
      include: this.includeProyecto(),
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    await this.verificarAcceso(usuarioId, proyecto);
    return proyecto;
  }

  private async verificarAcceso(
    usuarioId: number,
    proyecto: ProyectoAccesible,
  ): Promise<void> {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (agente) {
      const involucradas = [
        proyecto.solicitud.institucionDestinoId,
        proyecto.solicitud.asignacionOrigen.docenteInstitucion.institucionId,
      ];
      if (involucradas.includes(agente.institucionId)) return;
    }

    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
    });
    if (docente) {
      const participa = proyecto.docentes.some(
        (pd) =>
          pd.asignacionDocente.docenteInstitucion.docenteId === docente.id,
      );
      if (participa) return;
    }

    throw new ForbiddenException('No tienes acceso a este proyecto');
  }

  private async exigirAgenteInvolucrado(
    usuarioId: number,
    proyecto: {
      solicitud: ProyectoAccesible['solicitud'];
    },
  ) {
    const agente = await this.getAgente(usuarioId);
    const involucradas = [
      proyecto.solicitud.institucionDestinoId,
      proyecto.solicitud.asignacionOrigen.docenteInstitucion.institucionId,
    ];
    if (!involucradas.includes(agente.institucionId)) {
      throw new ForbiddenException(
        'Solo el agente de una institución participante puede realizar esta acción',
      );
    }
    return agente;
  }

  // El agente de internacionalización solo consulta: las acciones que
  // organizan la clase conjunta quedan reservadas a los docentes participantes.
  private async exigirDocenteParticipante(usuarioId: number, id: number) {
    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
    });
    if (docente) {
      const participa = await this.prisma.proyectoDocente.findFirst({
        where: {
          proyectoId: id,
          asignacionDocente: { docenteInstitucion: { docenteId: docente.id } },
        },
      });
      if (participa) return docente;
    }
    throw new ForbiddenException(
      'Solo un docente participante puede modificar la clase conjunta',
    );
  }

  private async getDocente(usuarioId: number) {
    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
    });
    if (!docente) {
      throw new UnauthorizedException('Solo un docente puede ver sus proyectos');
    }
    return docente;
  }

  private async getAgente(usuarioId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede gestionar proyectos',
      );
    }
    return agente;
  }

  private includePlanificacion() {
    return {
      participaciones: {
        include: {
          proyectoDocente: {
            include: {
              asignacionDocente: {
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
            },
          },
        },
      },
      reportes: { orderBy: { generadoEn: 'desc' as const } },
    };
  }

  private includeProyecto() {
    return {
      solicitud: {
        include: {
          materiaDestino: true,
          institucionDestino: true,
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
        },
      },
      docentes: {
        include: {
          asignacionDocente: {
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
        },
      },
      planificacion: { include: this.includePlanificacion() },
    };
  }
}
