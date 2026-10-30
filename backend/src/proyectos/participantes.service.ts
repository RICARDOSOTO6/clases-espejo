import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  ESTADO_PROYECTO_CANCELADO,
  ESTADO_PROYECTO_FINALIZADO,
} from '../common/estados';

const ROLES_PLENOS = ['ORIGEN', 'DESTINO', 'COLABORADORA'];
const ESTADOS_LECTURA = ['APROBADA', 'CONGELADA', 'RETIRADA'];
const ESTADOS_ACTIVOS = ['APROBADA', 'CONGELADA'];

interface ProyectoParticipacion {
  id: number;
  estado: string;
  motivoCancelacion?: string;
  canceladoEn?: Date | null;
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

  /** Estado de una solicitud de cancelación y sus votos. */
  async estadoCancelacion(usuarioId: number, proyectoId: number) {
    const proyecto = await this.cargar(proyectoId);
    await this.exigirLectura(usuarioId, proyecto);

    const [solicitud, participantes, eventos] = await Promise.all([
      this.prisma.cancelacionSolicitud.findFirst({
        where: { proyectoId },
        orderBy: { creadaEn: 'desc' },
        include: {
          votos: {
            include: { participante: { include: { institucion: true } } },
          },
        },
      }),
      this.prisma.proyectoParticipante.findMany({
        where: { proyectoId },
        include: { institucion: true },
        orderBy: { creadoEn: 'asc' },
      }),
      this.prisma.proyectoEvento.findMany({
        where: { proyectoId },
        orderBy: { creadoEn: 'desc' },
        take: 30,
      }),
    ]);

    return {
      estado: proyecto.estado,
      motivoCancelacion: proyecto.motivoCancelacion ?? '',
      canceladoEn: proyecto.canceladoEn ?? null,
      participantes: participantes.map((participante) => ({
        id: participante.id,
        institucionId: participante.institucionId,
        institucion: participante.institucion.nombre,
        rol: participante.rol,
        estado: participante.estado,
      })),
      solicitud: solicitud
        ? {
            id: solicitud.id,
            motivo: solicitud.motivo,
            estado: solicitud.estado,
            creadaEn: solicitud.creadaEn,
            resueltaEn: solicitud.resueltaEn,
            votos: solicitud.votos.map((voto) => ({
              participanteId: voto.participanteId,
              institucion: voto.participante.institucion.nombre,
              decision: voto.decision,
              motivo: voto.motivo,
            })),
          }
        : null,
      eventos: eventos.map((evento) => ({
        tipo: evento.tipo,
        motivo: evento.motivo,
        creadoEn: evento.creadoEn,
      })),
    };
  }

  /** Una institución sale de la clase; si quedan menos de dos, se cancela. */
  async salir(usuarioId: number, proyectoId: number, motivo: string) {
    const proyecto = await this.cargar(proyectoId);
    this.exigirProyectoAbierto(proyecto.estado);
    const actor = await this.exigirParticipantePleno(usuarioId, proyecto);
    const participante = proyecto.participantes.find(
      (p) =>
        p.institucionId === actor.institucionId &&
        ROLES_PLENOS.includes(p.rol) &&
        ESTADOS_ACTIVOS.includes(p.estado),
    );
    if (!participante) {
      throw new ForbiddenException('No eres participante activo de esta clase');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.proyectoParticipante.update({
        where: { id: participante.id },
        data: {
          estado: 'RETIRADA',
          retiradoEn: new Date(),
          motivoSalida: motivo.trim(),
        },
      });
      await tx.proyectoEvento.create({
        data: {
          proyectoId,
          participanteId: participante.id,
          tipo: 'SALIDA',
          motivo: motivo.trim(),
          actorUsuarioId: usuarioId,
        },
      });

      const activos = await tx.proyectoParticipante.count({
        where: {
          proyectoId,
          rol: { in: ROLES_PLENOS },
          estado: { in: ESTADOS_ACTIVOS },
        },
      });
      if (activos < 2) {
        await this.cancelarEnTx(
          tx,
          proyectoId,
          'Quedan menos de dos instituciones activas.',
          usuarioId,
        );
      }
    });

    return this.estadoCancelacion(usuarioId, proyectoId);
  }

  /** Solicita cancelar la clase; cada institución activa debe votar. */
  async solicitarCancelacion(
    usuarioId: number,
    proyectoId: number,
    motivo: string,
  ) {
    const proyecto = await this.cargar(proyectoId);
    this.exigirProyectoAbierto(proyecto.estado);
    const actor = await this.exigirParticipantePleno(usuarioId, proyecto);
    const participante = proyecto.participantes.find(
      (p) =>
        p.institucionId === actor.institucionId &&
        ROLES_PLENOS.includes(p.rol) &&
        ESTADOS_ACTIVOS.includes(p.estado),
    );
    if (!participante) {
      throw new ForbiddenException('No eres participante activo de esta clase');
    }
    const pendiente = await this.prisma.cancelacionSolicitud.findFirst({
      where: { proyectoId, estado: 'PENDIENTE' },
    });
    if (pendiente) {
      throw new BadRequestException(
        'Ya existe una solicitud de cancelación pendiente',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const solicitud = await tx.cancelacionSolicitud.create({
        data: {
          proyectoId,
          solicitadaPorUsuarioId: usuarioId,
          motivo: motivo.trim(),
        },
      });
      // La institución que propone la cancelación vota a favor de entrada.
      await tx.cancelacionVoto.create({
        data: {
          solicitudId: solicitud.id,
          participanteId: participante.id,
          usuarioId,
          decision: 'APROBADA',
          motivo: motivo.trim(),
        },
      });
      await tx.proyectoEvento.create({
        data: {
          proyectoId,
          participanteId: participante.id,
          tipo: 'CANCELACION_SOLICITADA',
          motivo: motivo.trim(),
          actorUsuarioId: usuarioId,
        },
      });
    });

    return this.estadoCancelacion(usuarioId, proyectoId);
  }

  /** Vota una solicitud pendiente; todas las instituciones activas deben aprobar. */
  async votarCancelacion(
    usuarioId: number,
    proyectoId: number,
    decision: 'APROBADA' | 'RECHAZADA',
    motivo: string,
  ) {
    const proyecto = await this.cargar(proyectoId);
    this.exigirProyectoAbierto(proyecto.estado);
    const actor = await this.exigirParticipantePleno(usuarioId, proyecto);
    const participante = proyecto.participantes.find(
      (p) =>
        p.institucionId === actor.institucionId &&
        ROLES_PLENOS.includes(p.rol) &&
        ESTADOS_ACTIVOS.includes(p.estado),
    );
    if (!participante) {
      throw new ForbiddenException('No eres participante activo de esta clase');
    }
    const solicitud = await this.prisma.cancelacionSolicitud.findFirst({
      where: { proyectoId, estado: 'PENDIENTE' },
    });
    if (!solicitud) {
      throw new NotFoundException('No hay una cancelación pendiente');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cancelacionVoto.upsert({
        where: {
          solicitudId_participanteId: {
            solicitudId: solicitud.id,
            participanteId: participante.id,
          },
        },
        create: {
          solicitudId: solicitud.id,
          participanteId: participante.id,
          usuarioId,
          decision,
          motivo: motivo.trim(),
        },
        update: {
          usuarioId,
          decision,
          motivo: motivo.trim(),
        },
      });
      await tx.proyectoEvento.create({
        data: {
          proyectoId,
          participanteId: participante.id,
          tipo:
            decision === 'APROBADA'
              ? 'VOTO_CANCELACION_APROBADO'
              : 'VOTO_CANCELACION_RECHAZADO',
          motivo: motivo.trim(),
          actorUsuarioId: usuarioId,
        },
      });

      if (decision === 'RECHAZADA') {
        await tx.cancelacionSolicitud.update({
          where: { id: solicitud.id },
          data: { estado: 'RECHAZADA', resueltaEn: new Date() },
        });
        return;
      }

      const [activos, aprobaciones] = await Promise.all([
        tx.proyectoParticipante.findMany({
          where: {
            proyectoId,
            rol: { in: ROLES_PLENOS },
            estado: { in: ESTADOS_ACTIVOS },
          },
          select: { id: true },
        }),
        tx.cancelacionVoto.findMany({
          where: { solicitudId: solicitud.id, decision: 'APROBADA' },
          select: { participanteId: true },
        }),
      ]);
      const todos = activos.every((activo) =>
        aprobaciones.some(
          (aprobacion) => aprobacion.participanteId === activo.id,
        ),
      );
      if (todos) {
        await tx.cancelacionSolicitud.update({
          where: { id: solicitud.id },
          data: { estado: 'APROBADA', resueltaEn: new Date() },
        });
        await this.cancelarEnTx(tx, proyectoId, solicitud.motivo, usuarioId);
      }
    });

    return this.estadoCancelacion(usuarioId, proyectoId);
  }

  private exigirProyectoAbierto(estado: string): void {
    if (
      estado === ESTADO_PROYECTO_FINALIZADO ||
      estado === ESTADO_PROYECTO_CANCELADO
    ) {
      throw new BadRequestException(
        'La clase ya está cerrada: no se puede cancelar ni salir.',
      );
    }
  }

  private async cancelarEnTx(
    tx: Prisma.TransactionClient,
    proyectoId: number,
    motivo: string,
    actorUsuarioId: number,
  ): Promise<void> {
    await tx.proyectoClaseEspejo.update({
      where: { id: proyectoId },
      data: {
        estado: ESTADO_PROYECTO_CANCELADO,
        motivoCancelacion: motivo,
        canceladoEn: new Date(),
      },
    });
    await tx.sesion.updateMany({
      where: {
        proyectoId,
        estado: { in: ['PROGRAMADA', 'EN_CURSO'] },
      },
      data: { estado: 'CANCELADA' },
    });
    await tx.proyectoEvento.create({
      data: {
        proyectoId,
        tipo: 'CANCELACION',
        motivo,
        actorUsuarioId,
      },
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
          (ESTADOS_LECTURA.includes(participante.estado) ||
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
          ESTADOS_LECTURA.includes(participante.estado) &&
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
              ESTADOS_LECTURA.includes(participante.estado),
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
        ESTADOS_ACTIVOS.includes(participante.estado),
    );
    if (!participa) {
      throw new ForbiddenException(
        'Solo una institución participante puede invitar a otra',
      );
    }
    return actor;
  }
}
