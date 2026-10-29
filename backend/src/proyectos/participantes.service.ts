import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ESTADO_PROYECTO_CANCELADO,
  ESTADO_PROYECTO_FINALIZADO,
} from '../common/estados';

const ROLES_PLENOS = ['ORIGEN', 'DESTINO', 'COLABORADORA'];
const ESTADOS_VIGENTES = ['APROBADA', 'CONGELADA'];

interface ProyectoParticipacion {
  id: number;
  estado: string;
  solicitud: {
    institucionDestinoId: number;
    asignacionOrigen: { docenteInstitucion: { institucionId: number } };
  };
  docentes: {
    id: number;
    asignacionDocente: {
      docenteInstitucion: { institucionId: number; docenteId: number };
    };
  }[];
  participantes: {
    id: number;
    institucionId: number;
    rol: string;
    estado: string;
  }[];
}

interface Actor {
  tipo: 'AGENTE' | 'DOCENTE';
  institucionId: number;
}

@Injectable()
export class ParticipantesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: number, proyectoId: number) {
    const proyecto = await this.cargar(proyectoId);
    await this.exigirLectura(usuarioId, proyecto);

    const participantes = await this.prisma.proyectoParticipante.findMany({
      where: { proyectoId },
      include: {
        institucion: true,
        docenteInstitucion: {
          include: { docente: { include: { usuario: true } } },
        },
      },
      orderBy: [{ rol: 'asc' }, { creadoEn: 'asc' }],
    });

    return participantes.map((participante) => ({
      id: participante.id,
      institucionId: participante.institucionId,
      institucion: participante.institucion.nombre,
      rol: participante.rol,
      estado: participante.estado,
      congeladoEn: participante.congeladoEn,
      docente: participante.docenteInstitucion
        ? {
            id: participante.docenteInstitucion.docenteId,
            nombre: participante.docenteInstitucion.docente.usuario.nombres,
            apellidos:
              participante.docenteInstitucion.docente.usuario.apellidoPaterno,
          }
        : null,
    }));
  }

  /** Invitaciones pendientes que debe revisar el agente autenticado. */
  async pendientes(usuarioId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (!agente) return [];

    const pendientes = await this.prisma.proyectoParticipante.findMany({
      where: {
        institucionId: agente.institucionId,
        estado: 'PENDIENTE',
        proyecto: {
          estado: {
            notIn: [ESTADO_PROYECTO_FINALIZADO, ESTADO_PROYECTO_CANCELADO],
          },
        },
      },
      include: {
        proyecto: {
          include: {
            solicitud: {
              include: {
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
      orderBy: { creadoEn: 'asc' },
    });

    return pendientes.map((participante) => ({
      participanteId: participante.id,
      proyectoId: participante.proyectoId,
      titulo: participante.proyecto.solicitud.titulo,
      fechaPropuesta: participante.proyecto.solicitud.fechaPropuesta,
      institucionOrigen:
        participante.proyecto.solicitud.asignacionOrigen.docenteInstitucion
          .institucion.nombre,
    }));
  }

  async agregar(usuarioId: number, proyectoId: number, institucionId: number) {
    const proyecto = await this.cargar(proyectoId);
    if (
      proyecto.estado === ESTADO_PROYECTO_FINALIZADO ||
      proyecto.estado === ESTADO_PROYECTO_CANCELADO
    ) {
      throw new BadRequestException(
        'La clase está cerrada; solo se pueden agregar observadoras',
      );
    }
    await this.exigirParticipantePleno(usuarioId, proyecto);

    const institucion = await this.prisma.institucion.findUnique({
      where: { id: institucionId },
    });
    if (!institucion || !institucion.activa) {
      throw new NotFoundException('Institución no encontrada o inactiva');
    }
    if (institucion.estadoCace !== 'APROBADA') {
      throw new BadRequestException(
        'La institución debe estar aprobada por la CACE',
      );
    }
    const existente = proyecto.participantes.some(
      (participante) => participante.institucionId === institucionId,
    );
    if (existente) {
      throw new BadRequestException(
        'La institución ya participa en esta clase espejo',
      );
    }

    return this.prisma.proyectoParticipante.create({
      data: {
        proyectoId,
        institucionId,
        rol: 'COLABORADORA',
        estado: 'PENDIENTE',
      },
      include: { institucion: true },
    });
  }

  async decidir(
    usuarioId: number,
    participanteId: number,
    dto: {
      decision: 'APROBADA' | 'RECHAZADA';
      asignacionDocenteId?: number;
      motivo?: string;
    },
  ) {
    const participante = await this.prisma.proyectoParticipante.findUnique({
      where: { id: participanteId },
      include: {
        proyecto: {
          include: {
            solicitud: {
              include: {
                asignacionOrigen: { include: { docenteInstitucion: true } },
              },
            },
          },
        },
      },
    });
    if (!participante) {
      throw new NotFoundException('Participación no encontrada');
    }
    if (participante.estado !== 'PENDIENTE') {
      throw new BadRequestException('Esta participación ya fue revisada');
    }
    if (
      participante.proyecto.estado === ESTADO_PROYECTO_FINALIZADO ||
      participante.proyecto.estado === ESTADO_PROYECTO_CANCELADO
    ) {
      throw new BadRequestException(
        'La clase está cerrada; no se puede revisar una participación',
      );
    }

    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (!agente || agente.institucionId !== participante.institucionId) {
      throw new ForbiddenException(
        'Solo el agente de la institución invitada puede decidir',
      );
    }

    if (dto.decision === 'RECHAZADA') {
      return this.prisma.proyectoParticipante.update({
        where: { id: participanteId },
        data: { estado: 'RECHAZADA' },
        include: { institucion: true },
      });
    }

    if (dto.asignacionDocenteId == null) {
      throw new BadRequestException(
        'Selecciona el docente que participará en la clase',
      );
    }
    const asignacion = await this.prisma.asignacionDocente.findFirst({
      where: {
        id: dto.asignacionDocenteId,
        docenteInstitucion: { institucionId: participante.institucionId },
      },
      include: { docenteInstitucion: true },
    });
    if (!asignacion) {
      throw new BadRequestException(
        'La asignación del docente no pertenece a la institución invitada',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.proyectoDocente.create({
        data: {
          proyectoId: participante.proyectoId,
          asignacionDocenteId: asignacion.id,
          rol: 'COLABORADORA',
        },
      });
      return tx.proyectoParticipante.update({
        where: { id: participanteId },
        data: {
          estado: 'APROBADA',
          docenteInstitucionId: asignacion.docenteInstitucionId,
        },
        include: { institucion: true },
      });
    });
  }

  async agregarObservador(
    usuarioId: number,
    proyectoId: number,
    institucionId: number,
  ) {
    const proyecto = await this.cargar(proyectoId);
    if (proyecto.estado !== ESTADO_PROYECTO_FINALIZADO) {
      throw new BadRequestException(
        'Solo se puede observar una clase después de que esté finalizada',
      );
    }
    await this.exigirParticipantePleno(usuarioId, proyecto);

    const institucion = await this.prisma.institucion.findUnique({
      where: { id: institucionId },
    });
    if (!institucion || !institucion.activa) {
      throw new NotFoundException('Institución no encontrada o inactiva');
    }
    if (institucion.estadoCace !== 'APROBADA') {
      throw new BadRequestException(
        'La institución debe estar aprobada por la CACE',
      );
    }
    const existente = proyecto.participantes.some(
      (participante) => participante.institucionId === institucionId,
    );
    if (existente) {
      throw new BadRequestException(
        'La institución ya participa o ya observa esta clase',
      );
    }

    return this.prisma.proyectoParticipante.create({
      data: {
        proyectoId,
        institucionId,
        rol: 'OBSERVADORA',
        estado: 'APROBADA',
        congeladoEn: new Date(),
      },
      include: { institucion: true },
    });
  }

  private async cargar(proyectoId: number): Promise<ProyectoParticipacion> {
    const proyecto = await this.prisma.proyectoClaseEspejo.findUnique({
      where: { id: proyectoId },
      include: {
        solicitud: {
          include: {
            asignacionOrigen: { include: { docenteInstitucion: true } },
          },
        },
        docentes: {
          include: {
            asignacionDocente: { include: { docenteInstitucion: true } },
          },
        },
        participantes: true,
      },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    return proyecto;
  }

  private async exigirLectura(
    usuarioId: number,
    proyecto: ProyectoParticipacion,
  ): Promise<Actor> {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (agente) {
      const participa = proyecto.participantes.some(
        (participante) =>
          participante.institucionId === agente.institucionId &&
          (ESTADOS_VIGENTES.includes(participante.estado) ||
            participante.estado === 'PENDIENTE'),
      );
      if (participa) {
        return { tipo: 'AGENTE', institucionId: agente.institucionId };
      }
      const origen =
        proyecto.solicitud.asignacionOrigen.docenteInstitucion.institucionId;
      if (
        agente.institucionId === origen ||
        agente.institucionId === proyecto.solicitud.institucionDestinoId
      ) {
        return { tipo: 'AGENTE', institucionId: agente.institucionId };
      }
    }

    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
    });
    if (docente) {
      const esDocente = proyecto.docentes.some(
        (docenteProyecto) =>
          docenteProyecto.asignacionDocente.docenteInstitucion.docenteId ===
          docente.id,
      );
      if (esDocente) {
        const institucionId = proyecto.docentes.find(
          (docenteProyecto) =>
            docenteProyecto.asignacionDocente.docenteInstitucion.docenteId ===
            docente.id,
        )!.asignacionDocente.docenteInstitucion.institucionId;
        return { tipo: 'DOCENTE', institucionId };
      }

      const instituciones = await this.prisma.docenteInstitucion.findMany({
        where: { docenteId: docente.id, activo: true },
        select: { institucionId: true },
      });
      const observa = proyecto.participantes.some(
        (participante) =>
          ESTADOS_VIGENTES.includes(participante.estado) &&
          instituciones.some(
            (institucion) =>
              institucion.institucionId === participante.institucionId,
          ),
      );
      if (observa) {
        const institucionId = instituciones.find((institucion) =>
          proyecto.participantes.some(
            (participante) =>
              participante.institucionId === institucion.institucionId &&
              ESTADOS_VIGENTES.includes(participante.estado),
          ),
        )!.institucionId;
        return { tipo: 'DOCENTE', institucionId };
      }
    }

    throw new ForbiddenException('No tienes acceso a este proyecto');
  }

  private async exigirParticipantePleno(
    usuarioId: number,
    proyecto: ProyectoParticipacion,
  ): Promise<Actor> {
    const actor = await this.exigirLectura(usuarioId, proyecto);
    const participa = proyecto.participantes.some(
      (participante) =>
        participante.institucionId === actor.institucionId &&
        ROLES_PLENOS.includes(participante.rol) &&
        ESTADOS_VIGENTES.includes(participante.estado),
    );
    if (!participa) {
      throw new ForbiddenException(
        'Solo una institución participante puede invitar a otra',
      );
    }
    return actor;
  }
}
