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

    return this.prisma.solicitudClaseEspejo.update({
      where: { id },
      data: { estado: dto.decision },
      include: this.includeEntrante(),
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
      institucionDestino: true,
      materiaDestino: true,
      revisiones: true,
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
    };
  }
}
