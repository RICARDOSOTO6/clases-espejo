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
import {
  ESTADO_PROYECTO_INICIAL,
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_APROBADA_POR_ORIGEN,
  ESTADO_SOLICITUD_PENDIENTE,
  ESTADO_SOLICITUD_RECHAZADA,
  ETAPA_REVISION_DESTINO,
  ETAPA_REVISION_ORIGEN,
} from '../common/estados';

// Semana 5: proyecto generado al aprobar una solicitud.
const PLATAFORMA_POR_DEFINIR = 'Por definir';
const ROL_ORIGEN = 'ORIGEN';
const ROL_DESTINO = 'DESTINO';
const DIAS_POR_DEFECTO = 14;

@Injectable()
export class SolicitudesService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(usuarioId: number, dto: CreateSolicitudDto) {
    const docente = await this.getDocente(usuarioId);
    this.verificarFechaFutura(dto.fechaPropuesta);

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
        estado: ESTADO_SOLICITUD_PENDIENTE,
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

    // Una solicitud rechazada se puede corregir y reenviar: vuelve a "Pendiente".
    if (
      solicitud.estado !== ESTADO_SOLICITUD_PENDIENTE &&
      solicitud.estado !== ESTADO_SOLICITUD_RECHAZADA
    ) {
      throw new BadRequestException(
        'Solo se puede editar una solicitud pendiente o rechazada',
      );
    }
    const reenviar = solicitud.estado === ESTADO_SOLICITUD_RECHAZADA;

    if (dto.fechaPropuesta !== undefined) {
      this.verificarFechaFutura(dto.fechaPropuesta);
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
        ...(reenviar ? { estado: ESTADO_SOLICITUD_PENDIENTE } : {}),
      },
      include: this.includeCompleto(),
    });
  }

  async cancelar(usuarioId: number, id: number) {
    const docente = await this.getDocente(usuarioId);
    const solicitud = await this.obtenerPropia(docente.id, id);

    if (
      solicitud.estado !== ESTADO_SOLICITUD_PENDIENTE &&
      solicitud.estado !== ESTADO_SOLICITUD_RECHAZADA
    ) {
      throw new BadRequestException(
        'Solo se puede cancelar una solicitud pendiente o rechazada',
      );
    }

    // Una solicitud rechazada tiene revisiones: sin borrarlas, la clave
    // foránea impide el borrado y el usuario vería un error 500.
    await this.prisma.$transaction([
      this.prisma.revisionSolicitud.deleteMany({ where: { solicitudId: id } }),
      this.prisma.solicitudClaseEspejo.delete({ where: { id } }),
    ]);
    return { mensaje: 'Solicitud cancelada' };
  }

  // --- Lado agente (Semana 4, doble revisión en Semana 7) ---

  /**
   * Bandeja del agente: solicitudes en las que participa su institución,
   * ya sea como origen (le toca la 1.ª revisión) o como destino (la 2.ª).
   */
  async listarEntrantes(usuarioId: number) {
    const agente = await this.getAgente(usuarioId);
    return this.prisma.solicitudClaseEspejo.findMany({
      where: {
        OR: [
          { institucionDestinoId: agente.institucionId },
          {
            asignacionOrigen: {
              docenteInstitucion: { institucionId: agente.institucionId },
            },
          },
        ],
      },
      include: this.includeEntrante(),
      orderBy: { creadoEn: 'desc' },
    });
  }

  /**
   * Doble revisión: primero el agente de la institución de origen y, si aprueba,
   * el de destino. La etapa se deduce de la institución del agente y del estado.
   */
  async revisar(usuarioId: number, id: number, dto: RevisarSolicitudDto) {
    const agente = await this.getAgente(usuarioId);
    const solicitud = await this.prisma.solicitudClaseEspejo.findUnique({
      where: { id },
      include: { asignacionOrigen: { include: { docenteInstitucion: true } } },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    const institucionOrigen =
      solicitud.asignacionOrigen.docenteInstitucion.institucionId;
    const esOrigen = agente.institucionId === institucionOrigen;
    const esDestino = agente.institucionId === solicitud.institucionDestinoId;

    if (!esOrigen && !esDestino) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (esOrigen && solicitud.estado === ESTADO_SOLICITUD_PENDIENTE) {
      return this.revisarOrigen(agente.id, solicitud.id, dto);
    }
    if (esDestino && solicitud.estado === ESTADO_SOLICITUD_APROBADA_POR_ORIGEN) {
      return this.revisarDestino(agente, solicitud, dto);
    }

    throw new BadRequestException(
      'La solicitud no está en una etapa que te corresponda revisar',
    );
  }

  /** Etapa 1: el agente de origen autoriza (o rechaza) la propuesta. */
  private async revisarOrigen(
    agenteId: number,
    solicitudId: number,
    dto: RevisarSolicitudDto,
  ) {
    this.exigirMotivoSiRechaza(dto);

    await this.registrarRevision(
      solicitudId,
      agenteId,
      ETAPA_REVISION_ORIGEN,
      dto,
    );

    await this.prisma.solicitudClaseEspejo.update({
      where: { id: solicitudId },
      data: {
        estado:
          dto.decision === ESTADO_SOLICITUD_RECHAZADA
            ? ESTADO_SOLICITUD_RECHAZADA
            : ESTADO_SOLICITUD_APROBADA_POR_ORIGEN,
      },
    });

    return this.prisma.solicitudClaseEspejo.findUniqueOrThrow({
      where: { id: solicitudId },
      include: this.includeEntrante(),
    });
  }

  /** Etapa 2: el agente de destino acepta y se crea el proyecto. */
  private async revisarDestino(
    agente: { id: number; institucionId: number },
    solicitud: { id: number; asignacionOrigenId: number; fechaPropuesta: Date },
    dto: RevisarSolicitudDto,
  ) {
    this.exigirMotivoSiRechaza(dto);

    let asignacionDestinoId: number | null = null;
    if (dto.decision === ESTADO_SOLICITUD_APROBADA) {
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

    await this.registrarRevision(
      solicitud.id,
      agente.id,
      ETAPA_REVISION_DESTINO,
      dto,
    );

    const actualizada = await this.prisma.solicitudClaseEspejo.update({
      where: { id: solicitud.id },
      data: {
        estado: dto.decision,
        ...(asignacionDestinoId != null ? { asignacionDestinoId } : {}),
      },
      include: this.includeEntrante(),
    });

    if (dto.decision === ESTADO_SOLICITUD_APROBADA) {
      await this.crearProyectoSiNoExiste(
        solicitud.id,
        solicitud,
        asignacionDestinoId!,
      );
      return this.prisma.solicitudClaseEspejo.findUniqueOrThrow({
        where: { id: solicitud.id },
        include: this.includeEntrante(),
      });
    }

    return actualizada;
  }

  private exigirMotivoSiRechaza(dto: RevisarSolicitudDto): void {
    if (dto.decision === ESTADO_SOLICITUD_RECHAZADA && !dto.comentario?.trim()) {
      throw new BadRequestException(
        'Indica el motivo del rechazo en el comentario',
      );
    }
  }

  private async registrarRevision(
    solicitudId: number,
    agenteId: number,
    etapa: string,
    dto: RevisarSolicitudDto,
  ): Promise<void> {
    await this.prisma.revisionSolicitud.create({
      data: {
        solicitudId,
        agenteId,
        etapa,
        decision: dto.decision,
        comentario: dto.comentario ?? '',
        revisadaEn: new Date(),
      },
    });
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

  /** La fecha propuesta no puede estar en el pasado (se compara por día). */
  private verificarFechaFutura(fecha: string): void {
    const hoy = new Date();
    const hoyTexto = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    if (fecha.slice(0, 10) < hoyTexto) {
      throw new BadRequestException(
        'La fecha propuesta no puede estar en el pasado',
      );
    }
  }

  private async obtenerPropia(docenteId: number, id: number) {    const solicitud = await this.prisma.solicitudClaseEspejo.findFirst({
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
