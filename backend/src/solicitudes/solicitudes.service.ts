import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { RevisarSolicitudDto } from './dto/revisar-solicitud.dto';

const ESTADO_PENDIENTE = 'PENDIENTE';
const ETAPA_REVISION_INICIAL = 'REVISION_INICIAL';

// Semana 5: proyecto generado al aprobar una solicitud.
const ESTADO_PROYECTO_INICIAL = 'EN_PLANIFICACION';
const PLATAFORMA_POR_DEFINIR = 'Por definir';
const ROL_ORIGEN = 'ORIGEN';
const ROL_DESTINO = 'DESTINO';
const DIAS_POR_DEFECTO = 14;

@Injectable()
export class SolicitudesService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(usuarioId: number, dto: CreateSolicitudDto) {
    const docente = await this.getDocente(usuarioId);

    const asignacion = await this.prisma.asignacionDocente.findFirst({
      where: {
        id: dto.asignacionOrigenId,
        docenteInstitucion: { docenteId: docente.id },
      },
      include: { docenteInstitucion: true },
    });
    if (!asignacion) {
      throw new NotFoundException('La asignación de origen no es válida');
    }

    if (
      dto.institucionDestinoId === asignacion.docenteInstitucion.institucionId
    ) {
      throw new BadRequestException(
        'La institución destino debe ser diferente a la de origen',
      );
    }

    const destino = await this.prisma.institucion.findFirst({
      where: { id: dto.institucionDestinoId, activa: true },
    });
    if (!destino) throw new NotFoundException('Institución destino no encontrada');

    if (dto.materiaDestinoId != null) {
      const materiaDestino = await this.prisma.materia.findFirst({
        where: {
          id: dto.materiaDestinoId,
          institucionId: dto.institucionDestinoId,
        },
      });
      if (!materiaDestino) {
        throw new BadRequestException(
          'La materia destino no pertenece a la institución destino',
        );
      }
    }

    return this.prisma.solicitudClaseEspejo.create({
      data: {
        asignacionOrigenId: dto.asignacionOrigenId,
        institucionDestinoId: dto.institucionDestinoId,
        materiaDestinoId: dto.materiaDestinoId ?? null,
        titulo: dto.titulo,
        objetivo: dto.objetivo,
        fechaPropuesta: new Date(dto.fechaPropuesta),
        estado: ESTADO_PENDIENTE,
      },
      include: this.includeCompleto(),
    });
  }

  async listarMias(usuarioId: number) {
    const docente = await this.getDocente(usuarioId);
    return this.prisma.solicitudClaseEspejo.findMany({
      where: {
        asignacionOrigen: { docenteInstitucion: { docenteId: docente.id } },
      },
      include: this.includeCompleto(),
      orderBy: { creadoEn: 'desc' },
    });
  }

  async actualizar(usuarioId: number, id: number, dto: UpdateSolicitudDto) {
    const docente = await this.getDocente(usuarioId);
    const solicitud = await this.obtenerPropia(docente.id, id);

    if (solicitud.estado !== ESTADO_PENDIENTE) {
      throw new BadRequestException(
        'Solo se puede editar una solicitud pendiente',
      );
    }

    const asignacionOrigenId =
      dto.asignacionOrigenId ?? solicitud.asignacionOrigenId;
    const institucionDestinoId =
      dto.institucionDestinoId ?? solicitud.institucionDestinoId;

    const asignacion = await this.prisma.asignacionDocente.findFirst({
      where: {
        id: asignacionOrigenId,
        docenteInstitucion: { docenteId: docente.id },
      },
      include: { docenteInstitucion: true },
    });
    if (!asignacion) {
      throw new NotFoundException('La asignación de origen no es válida');
    }

    if (institucionDestinoId === asignacion.docenteInstitucion.institucionId) {
      throw new BadRequestException(
        'La institución destino debe ser diferente a la de origen',
      );
    }

    if (dto.materiaDestinoId != null) {
      const materiaDestino = await this.prisma.materia.findFirst({
        where: {
          id: dto.materiaDestinoId,
          institucionId: institucionDestinoId,
        },
      });
      if (!materiaDestino) {
        throw new BadRequestException(
          'La materia destino no pertenece a la institución destino',
        );
      }
    }

    return this.prisma.solicitudClaseEspejo.update({
      where: { id },
      data: {
        ...(dto.asignacionOrigenId !== undefined
          ? { asignacionOrigenId: dto.asignacionOrigenId }
          : {}),
        ...(dto.institucionDestinoId !== undefined
          ? { institucionDestinoId: dto.institucionDestinoId }
          : {}),
        ...(dto.materiaDestinoId !== undefined
          ? { materiaDestinoId: dto.materiaDestinoId ?? null }
          : {}),
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.objetivo !== undefined ? { objetivo: dto.objetivo } : {}),
        ...(dto.fechaPropuesta !== undefined
          ? { fechaPropuesta: new Date(dto.fechaPropuesta) }
          : {}),
      },
      include: this.includeCompleto(),
    });
  }

  async cancelar(usuarioId: number, id: number) {
    const docente = await this.getDocente(usuarioId);
    const solicitud = await this.obtenerPropia(docente.id, id);

    if (solicitud.estado !== ESTADO_PENDIENTE) {
      throw new BadRequestException(
        'Solo se puede cancelar una solicitud pendiente',
      );
    }

    await this.prisma.solicitudClaseEspejo.delete({ where: { id } });
    return { mensaje: 'Solicitud cancelada' };
  }

  // --- Lado agente (Semana 4) ---
  async listarEntrantes(usuarioId: number) {
    const agente = await this.getAgente(usuarioId);
    return this.prisma.solicitudClaseEspejo.findMany({
      where: { institucionDestinoId: agente.institucionId },
      include: this.includeEntrante(),
      orderBy: { creadoEn: 'desc' },
    });
  }

  async revisar(usuarioId: number, id: number, dto: RevisarSolicitudDto) {
    const agente = await this.getAgente(usuarioId);
    const solicitud = await this.prisma.solicitudClaseEspejo.findFirst({
      where: { id, institucionDestinoId: agente.institucionId },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    if (solicitud.estado !== ESTADO_PENDIENTE) {
      throw new BadRequestException('La solicitud ya fue revisada');
    }

    if (dto.decision === 'RECHAZADA' && !dto.comentario?.trim()) {
      throw new BadRequestException(
        'Indica el motivo del rechazo en el comentario',
      );
    }

    let asignacionDestinoId: number | null = null;
    if (dto.decision === 'APROBADA') {
      if (dto.asignacionDestinoId == null) {
        throw new BadRequestException(
          'Selecciona el docente que impartirá la clase espejo',
        );
      }
      const destino = await this.prisma.asignacionDocente.findFirst({
        where: {
          id: dto.asignacionDestinoId,
          docenteInstitucion: { institucionId: agente.institucionId },
        },
      });
      if (!destino) {
        throw new BadRequestException(
          'La asignación del docente seleccionado no es válida',
        );
      }
      asignacionDestinoId = destino.id;
    }

    await this.prisma.revisionSolicitud.create({
      data: {
        solicitudId: id,
        agenteId: agente.id,
        etapa: ETAPA_REVISION_INICIAL,
        decision: dto.decision,
        comentario: dto.comentario ?? '',
        revisadaEn: new Date(),
      },
    });

    const actualizada = await this.prisma.solicitudClaseEspejo.update({
      where: { id },
      data: {
        estado: dto.decision,
        ...(asignacionDestinoId != null ? { asignacionDestinoId } : {}),
      },
      include: this.includeEntrante(),
    });

    if (dto.decision === 'APROBADA') {
      await this.crearProyectoSiNoExiste(id, solicitud, asignacionDestinoId!);
      return this.prisma.solicitudClaseEspejo.findUniqueOrThrow({
        where: { id },
        include: this.includeEntrante(),
      });
    }

    return actualizada;
  }

  /**
   * Semana 5: al aprobar una solicitud se crea el proyecto de clase espejo
   * y se incorpora al docente de origen como participante.
   */
  private async crearProyectoSiNoExiste(
    solicitudId: number,
    solicitud: { asignacionOrigenId: number; fechaPropuesta: Date },
    asignacionDestinoId: number,
  ): Promise<void> {
    const existente = await this.prisma.proyectoClaseEspejo.findUnique({
      where: { solicitudId },
      select: { id: true },
    });
    if (existente) return;

    const inicio = new Date(solicitud.fechaPropuesta);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + DIAS_POR_DEFECTO);

    const proyecto = await this.prisma.proyectoClaseEspejo.create({
      data: {
        solicitudId,
        estado: ESTADO_PROYECTO_INICIAL,
        fechaInicio: inicio,
        fechaFin: fin,
        plataforma: PLATAFORMA_POR_DEFINIR,
      },
    });

    await this.prisma.proyectoDocente.createMany({
      data: [
        {
          proyectoId: proyecto.id,
          asignacionDocenteId: solicitud.asignacionOrigenId,
          rol: ROL_ORIGEN,
        },
        {
          proyectoId: proyecto.id,
          asignacionDocenteId: asignacionDestinoId,
          rol: ROL_DESTINO,
        },
      ],
    });
  }

  private async obtenerPropia(docenteId: number, id: number) {
    const solicitud = await this.prisma.solicitudClaseEspejo.findFirst({
      where: {
        id,
        asignacionOrigen: { docenteInstitucion: { docenteId } },
      },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    return solicitud;
  }

  private async getDocente(usuarioId: number) {
    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
    });
    if (!docente) {
      throw new UnauthorizedException(
        'Solo un docente puede gestionar solicitudes',
      );
    }
    return docente;
  }

  private async getAgente(usuarioId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede revisar solicitudes',
      );
    }
    return agente;
  }

  private includeEntrante() {
    return {
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
            include: { docente: { include: { usuario: true } } },
          },
        },
      },
      institucionDestino: true,
      materiaDestino: true,
      revisiones: true,
      proyecto: { select: { id: true, estado: true } },
    };
  }

  private includeCompleto() {
    return {
      asignacionOrigen: {
        include: {
          materia: true,
          docenteInstitucion: { include: { institucion: true } },
        },
      },
      institucionDestino: true,
      materiaDestino: true,
      revisiones: true,
      proyecto: { select: { id: true, estado: true } },
    };
  }
}
