import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { exigirAgenteHabilitado } from '../common/institucion-habilitada';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { RevisarSolicitudDto } from './dto/revisar-solicitud.dto';
import {
  ESTADO_PROYECTO_INICIAL,
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_APROBADA_POR_ORIGEN,
  ESTADO_SOLICITUD_CADUCADA,
  ESTADO_SOLICITUD_PENDIENTE,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADOS_SOLICITUD_EN_REVISION,
  ETAPA_REVISION_DESTINO,
  ETAPA_REVISION_ORIGEN,
  ESTADO_CACE_APROBADA,
  ESTADO_CACE_PENDIENTE,
  ESTADO_CACE_RECHAZADA,
  ESTADO_CACE_VETADA,
} from '../common/estados';
import {
  corteCaducidad,
  diaDeColumna,
  diaLocal,
  diasAntelacionRevision,
  diasHasta,
  diasMinimosPropuesta,
  fechaLimiteRevision,
  fechaMinimaPropuesta,
  textoDeColumna,
  urgenciaSegunDias,
  type Urgencia,
} from '../common/plazos';
import type { Prisma } from '../../generated/prisma/client';

// Semana 5: proyecto generado al aprobar una solicitud.
const PLATAFORMA_POR_DEFINIR = 'Por definir';
const ROL_ORIGEN = 'ORIGEN';
const ROL_DESTINO = 'DESTINO';
const DIAS_POR_DEFECTO = 14;

/**
 * Estados en los que una solicitud puede llegar a los ojos del agente de
 * destino. `PENDIENTE` no está: mientras el origen no la apruebe, el destino
 * **ni se entera** (ver `destinoConoce`). Los dos últimos son los estados
 * cerrados, que después se afinan mirando quién los cerró.
 */
const ESTADOS_VISIBLES_PARA_DESTINO: string[] = [
  ESTADO_SOLICITUD_APROBADA_POR_ORIGEN,
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_CADUCADA,
];

@Injectable()
export class SolicitudesService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(usuarioId: number, dto: CreateSolicitudDto) {
    // Un agente cuya institución no está aprobada (o cuyo alta aún no está
    // confirmada) no opera: el mensaje se lo dice antes que nada.
    await exigirAgenteHabilitado(this.prisma, usuarioId);

    const docente = await this.getDocente(usuarioId);
    await this.verificarFechaPropuesta(dto.fechaPropuesta);

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

    // Ni propone ni recibe quien no está aprobado por la CACE. Se comprueban las
    // dos puntas para que el mensaje diga cuál es la que bloquea.
    const origen = await this.prisma.institucion.findUnique({
      where: { id: asignacion.docenteInstitucion.institucionId },
      select: { nombre: true, estadoCace: true, motivoCace: true },
    });
    this.exigirInstitucionAprobada(origen, 'origen');

    const destino = await this.prisma.institucion.findFirst({
      where: { id: dto.institucionDestinoId, activa: true },
      select: { nombre: true, estadoCace: true, motivoCace: true },
    });
    if (!destino)
      throw new NotFoundException('Institución destino no encontrada');
    this.exigirInstitucionAprobada(destino, 'destino');

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
    // Antes de responder se revisa si alguna propuesta venció sin respuesta.
    await this.mantenimiento();
    const { revision } = await this.plazos();
    const solicitudes = await this.prisma.solicitudClaseEspejo.findMany({
      where: {
        asignacionOrigen: { docenteInstitucion: { docenteId: docente.id } },
      },
      include: this.includeCompleto(),
      orderBy: { creadoEn: 'desc' },
    });
    return solicitudes.map((solicitud) => this.conPlazos(solicitud, revision));
  }

  /**
   * Añade a cada solicitud el plazo de respuesta calculado: hasta cuándo se
   * puede responder, cuántos días quedan y qué urgencia tiene.
   */
  private conPlazos<T extends { fechaPropuesta: Date; estado: string }>(
    solicitud: T,
    diasRevision: number,
  ): T & {
    fechaLimite: Date;
    diasRestantes: number;
    urgencia: Urgencia;
    enRevision: boolean;
  } {
    const fechaLimite = fechaLimiteRevision(
      solicitud.fechaPropuesta,
      diasRevision,
    );
    const diasRestantes = diasHasta(fechaLimite);
    const enRevision = ESTADOS_SOLICITUD_EN_REVISION.includes(solicitud.estado);
    return {
      ...solicitud,
      fechaLimite,
      diasRestantes,
      // Solo las que esperan respuesta tienen urgencia: las demás están cerradas.
      urgencia: enRevision ? urgenciaSegunDias(diasRestantes) : 'NORMAL',
      enRevision,
    };
  }

  /**
   * Cancela las solicitudes cuyo plazo de respuesta venció: nadie contestó
   * (etapa de origen) o nadie confirmó (etapa de destino).
   *
   * No se registra una revisión porque quien caduca no es un agente; el estado
   * y la fecha límite ya explican el motivo. Se llama al listar y desde el
   * planificador de recordatorios.
   */
  async caducarVencidas(): Promise<number> {
    const { revision } = await this.plazos();
    const { count } = await this.prisma.solicitudClaseEspejo.updateMany({
      where: {
        estado: { in: ESTADOS_SOLICITUD_EN_REVISION },
        fechaPropuesta: { lt: corteCaducidad(new Date(), revision) },
      },
      data: { estado: ESTADO_SOLICITUD_CADUCADA },
    });
    return count;
  }

  /**
   * Repara solicitudes que quedaron APROBADAS sin su clase espejo. Hoy el
   * cambio de estado y la creación del proyecto van en la misma transacción, así
   * que no puede volver a pasar; esto cierra el caso de los datos anteriores.
   */
  async reconciliarProyectos(): Promise<number> {
    const huerfanas = await this.prisma.solicitudClaseEspejo.findMany({
      where: {
        estado: ESTADO_SOLICITUD_APROBADA,
        proyecto: null,
        asignacionDestinoId: { not: null },
      },
      select: {
        id: true,
        asignacionOrigenId: true,
        asignacionDestinoId: true,
        fechaPropuesta: true,
      },
      take: 50,
    });

    for (const solicitud of huerfanas) {
      await this.crearProyectoSiNoExiste(
        solicitud.id,
        solicitud,
        solicitud.asignacionDestinoId!,
      );
    }
    return huerfanas.length;
  }

  /**
   * Tareas de mantenimiento que se ejecutan antes de listar y desde el
   * planificador: caducar lo vencido y reparar aprobaciones sin proyecto.
   */
  async mantenimiento(): Promise<{
    caducadas: number;
    reconciliadas: number;
  }> {
    const caducadas = await this.caducarVencidas();
    const reconciliadas = await this.reconciliarProyectos();
    return { caducadas, reconciliadas };
  }

  async actualizar(usuarioId: number, id: number, dto: UpdateSolicitudDto) {
    const docente = await this.getDocente(usuarioId);
    const solicitud = await this.obtenerPropia(docente.id, id);

    // Una solicitud rechazada o caducada se puede corregir y reenviar: vuelve a
    // "Pendiente" (con la fecha nueva, que debe ser futura).
    const editables = [
      ESTADO_SOLICITUD_PENDIENTE,
      ESTADO_SOLICITUD_RECHAZADA,
      ESTADO_SOLICITUD_CADUCADA,
    ];
    if (!editables.includes(solicitud.estado)) {
      throw new BadRequestException(
        'Solo se puede editar una solicitud pendiente, rechazada o caducada',
      );
    }
    const reenviar = solicitud.estado !== ESTADO_SOLICITUD_PENDIENTE;

    if (dto.fechaPropuesta !== undefined) {
      await this.verificarFechaPropuesta(dto.fechaPropuesta);
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
        // Si cambia la institución destino y no se reenvía la materia, la
        // anterior ya no le pertenece: se limpia en vez de dejarla incoherente.
        ...(dto.materiaDestinoId !== undefined
          ? { materiaDestinoId: dto.materiaDestinoId ?? null }
          : dto.institucionDestinoId !== undefined &&
              dto.institucionDestinoId !== solicitud.institucionDestinoId
            ? { materiaDestinoId: null }
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
      solicitud.estado !== ESTADO_SOLICITUD_RECHAZADA &&
      solicitud.estado !== ESTADO_SOLICITUD_CADUCADA
    ) {
      throw new BadRequestException(
        'Solo se puede cancelar una solicitud pendiente, rechazada o caducada',
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
   *
   * El destino **solo ve lo que el origen ya aprobó**: hasta entonces su
   * institución no participa en nada y avisarla sería avisarla por nada (si el
   * origen rechaza, nunca debe enterarse). El origen sigue viendo todo lo que
   * propusieron sus docentes, en cualquier estado.
   */
  async listarEntrantes(usuarioId: number) {
    const agente = await this.getAgente(usuarioId);
    await this.mantenimiento();
    const solicitudes = await this.prisma.solicitudClaseEspejo.findMany({
      where: {
        OR: [
          {
            asignacionOrigen: {
              docenteInstitucion: { institucionId: agente.institucionId },
            },
          },
          {
            institucionDestinoId: agente.institucionId,
            estado: { in: ESTADOS_VISIBLES_PARA_DESTINO },
          },
        ],
      },
      include: this.includeEntrante(),
      orderBy: { creadoEn: 'desc' },
    });
    // El descarte fino (una solicitud cerrada antes de la aprobación del origen)
    // va aquí, con las revisiones ya incluidas, para no ensuciar el `where`.
    const visibles = solicitudes.filter((solicitud) =>
      this.esDelOrigen(solicitud, agente.institucionId)
        ? true
        : this.destinoConoce(solicitud),
    );
    const { revision } = await this.plazos();
    return visibles.map((solicitud) => this.conPlazos(solicitud, revision));
  }

  /** ¿La institución del agente es la que propone la clase espejo? */
  private esDelOrigen(
    solicitud: {
      asignacionOrigen: { docenteInstitucion: { institucionId: number } };
    },
    institucionId: number,
  ): boolean {
    return (
      solicitud.asignacionOrigen.docenteInstitucion.institucionId ===
      institucionId
    );
  }

  /**
   * ¿El agente de destino puede enterarse de esta solicitud?
   *
   * Solo desde que el origen la aprueba. Con el estado no basta para las
   * solicitudes cerradas —`RECHAZADA`/`CADUCADA` pueden venir de que el origen
   * dijo que no (el destino no debe saberlo jamás) o de que el propio destino
   * rechazó o dejó vencer la suya (que sí la conocía)—, así que se mira quién
   * cerró: cuenta la última revisión de origen.
   */
  private destinoConoce(solicitud: {
    estado: string;
    revisiones: {
      id: number;
      etapa: string;
      decision: string;
      revisadaEn: Date;
    }[];
  }): boolean {
    if (
      solicitud.estado === ESTADO_SOLICITUD_APROBADA_POR_ORIGEN ||
      solicitud.estado === ESTADO_SOLICITUD_APROBADA
    ) {
      return true;
    }
    if (
      solicitud.estado !== ESTADO_SOLICITUD_RECHAZADA &&
      solicitud.estado !== ESTADO_SOLICITUD_CADUCADA
    ) {
      return false;
    }
    const delOrigen = solicitud.revisiones
      .filter((revision) => revision.etapa === ETAPA_REVISION_ORIGEN)
      .sort(
        (a, b) =>
          a.revisadaEn.getTime() - b.revisadaEn.getTime() || a.id - b.id,
      );
    return (
      delOrigen[delOrigen.length - 1]?.decision === ESTADO_SOLICITUD_APROBADA
    );
  }

  /**
   * Doble revisión: primero el agente de la institución de origen y, si aprueba,
   * el de destino. La etapa se deduce de la institución del agente y del estado.
   */
  async revisar(usuarioId: number, id: number, dto: RevisarSolicitudDto) {
    const agente = await this.getAgente(usuarioId);
    // Antes de decidir se comprueba el vencimiento: entre dos pasadas del
    // planificador, una solicitud fuera de plazo no debe poder aprobarse.
    await this.mantenimiento();
    const solicitud = await this.prisma.solicitudClaseEspejo.findUnique({
      where: { id },
      include: {
        asignacionOrigen: { include: { docenteInstitucion: true } },
        revisiones: true,
      },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    const institucionOrigen =
      solicitud.asignacionOrigen.docenteInstitucion.institucionId;
    const esOrigen = agente.institucionId === institucionOrigen;
    const esDestino = agente.institucionId === solicitud.institucionDestinoId;

    // Mientras el origen no apruebe, para el destino la solicitud **no existe**:
    // ni se lista (ver `listarEntrantes`) ni se puede revisar por identificador
    // directo. Se responde 404, igual que cuando la institución no participa.
    if (!esOrigen && (!esDestino || !this.destinoConoce(solicitud))) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (solicitud.estado === ESTADO_SOLICITUD_CADUCADA) {
      throw new BadRequestException(
        'La solicitud caducó por falta de respuesta: el docente debe reenviarla con una fecha nueva',
      );
    }

    if (esOrigen && solicitud.estado === ESTADO_SOLICITUD_PENDIENTE) {
      return this.revisarOrigen(agente.id, solicitud.id, dto);
    }
    if (
      esDestino &&
      solicitud.estado === ESTADO_SOLICITUD_APROBADA_POR_ORIGEN
    ) {
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

    // El cambio de estado y su registro van juntos: si fallara el segundo, la
    // solicitud quedaría revisada sin historial.
    await this.prisma.$transaction(async (tx) => {
      // Transición condicional: si otra revisión ganó la carrera, esta no aplica.
      const cambio = await tx.solicitudClaseEspejo.updateMany({
        where: { id: solicitudId, estado: ESTADO_SOLICITUD_PENDIENTE },
        data: {
          estado:
            dto.decision === ESTADO_SOLICITUD_RECHAZADA
              ? ESTADO_SOLICITUD_RECHAZADA
              : ESTADO_SOLICITUD_APROBADA_POR_ORIGEN,
        },
      });
      if (cambio.count === 0) {
        throw new BadRequestException('La solicitud ya fue revisada');
      }

      await this.registrarRevision(
        solicitudId,
        agenteId,
        ETAPA_REVISION_ORIGEN,
        dto,
        tx,
      );
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

    // Aprobar la solicitud y crear la clase espejo es **una sola operación**: si
    // fallara el proyecto, la solicitud quedaría APROBADA sin proyecto y sin
    // ninguna vía de recuperación por la API.
    await this.prisma.$transaction(async (tx) => {
      // Transición condicional: solo una petición cierra la 2.ª etapa, así que el
      // proyecto no se crea dos veces.
      const cambio = await tx.solicitudClaseEspejo.updateMany({
        where: {
          id: solicitud.id,
          estado: ESTADO_SOLICITUD_APROBADA_POR_ORIGEN,
        },
        data: {
          estado: dto.decision,
          ...(asignacionDestinoId != null ? { asignacionDestinoId } : {}),
        },
      });
      if (cambio.count === 0) {
        throw new BadRequestException('La solicitud ya fue revisada');
      }

      await this.registrarRevision(
        solicitud.id,
        agente.id,
        ETAPA_REVISION_DESTINO,
        dto,
        tx,
      );

      if (dto.decision === ESTADO_SOLICITUD_APROBADA) {
        await this.crearProyectoSiNoExiste(
          solicitud.id,
          solicitud,
          asignacionDestinoId!,
          tx,
        );
      }
    });

    return this.prisma.solicitudClaseEspejo.findUniqueOrThrow({
      where: { id: solicitud.id },
      include: this.includeEntrante(),
    });
  }

  /**
   * Una institución que no está aprobada por la CACE no opera: no puede proponer
   * (origen) ni recibir (destino) clases espejo. El mensaje dice **por qué** está
   * bloqueada y con qué motivo, que es lo único que le permite desbloquearse.
   */
  private exigirInstitucionAprobada(
    institucion: {
      nombre: string;
      estadoCace: string;
      motivoCace: string;
    } | null,
    papel: 'origen' | 'destino',
  ): void {
    if (!institucion) {
      throw new NotFoundException('Institución no encontrada');
    }
    if (institucion.estadoCace === ESTADO_CACE_APROBADA) return;

    const situacion =
      institucion.estadoCace === ESTADO_CACE_PENDIENTE
        ? 'está pendiente de aprobación por la CACE'
        : institucion.estadoCace === ESTADO_CACE_RECHAZADA
          ? 'fue rechazada por la CACE'
          : institucion.estadoCace === ESTADO_CACE_VETADA
            ? 'fue vetada por la CACE'
            : 'no está aprobada por la CACE';
    const accion =
      papel === 'origen' ? 'proponer clases espejo' : 'recibir clases espejo';
    const motivo = institucion.motivoCace?.trim();

    throw new BadRequestException(
      `La institución de ${papel} (${institucion.nombre}) ${situacion}: todavía no puede ${accion}.${motivo ? ` Motivo: ${motivo}` : ''}`,
    );
  }

  private exigirMotivoSiRechaza(dto: RevisarSolicitudDto): void {
    if (
      dto.decision === ESTADO_SOLICITUD_RECHAZADA &&
      !dto.comentario?.trim()
    ) {
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
    cliente: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await cliente.revisionSolicitud.create({
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
    cliente: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const existente = await cliente.proyectoClaseEspejo.findUnique({
      where: { solicitudId },
      select: { id: true },
    });
    if (existente) return;

    // Aritmética en UTC: `fechaPropuesta` es una columna DATE y se lee como
    // medianoche UTC. Con `getDate()/setDate()` se sumaba o restaba un día.
    const inicio = diaDeColumna(solicitud.fechaPropuesta);
    const fin = new Date(inicio);
    fin.setUTCDate(fin.getUTCDate() + DIAS_POR_DEFECTO);

    const proyecto = await cliente.proyectoClaseEspejo.create({
      data: {
        solicitudId,
        estado: ESTADO_PROYECTO_INICIAL,
        fechaInicio: inicio,
        fechaFin: fin,
        plataforma: PLATAFORMA_POR_DEFINIR,
      },
    });

    await cliente.proyectoDocente.createMany({
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

  /**
   * La fecha propuesta debe ser futura y respetar la antelación con la que las
   * instituciones pueden responder. Sin esto, una propuesta para pasado mañana
   * nacía ya caducada y nadie podía contestarla.
   */
  /**
   * Lee los dos plazos de la configuración de la CACE. Si la fila no existe,
   * usa los valores por defecto (8 y 7) y el respaldo de entorno de la revisión.
   */
  private async plazos(): Promise<{ minimos: number; revision: number }> {
    const config = await this.prisma.configuracionCace.findFirst({
      select: { diasMinimosPropuesta: true, diasRevision: true },
    });
    return {
      minimos: config?.diasMinimosPropuesta ?? diasMinimosPropuesta(),
      revision: config?.diasRevision ?? diasAntelacionRevision(),
    };
  }

  /** Los días mínimos para proponer, para el formulario del docente. */
  async diasMinimosPropuestaConfig(): Promise<number> {
    return (await this.plazos()).minimos;
  }

  /** Los días de revisión vigentes, para la agenda de recordatorios. */
  async diasRevision(): Promise<number> {
    return (await this.plazos()).revision;
  }

  private async verificarFechaPropuesta(fecha: string): Promise<void> {
    const { minimos } = await this.plazos();
    const propuesta = fecha.slice(0, 10);
    const hoy = textoDeColumna(diaLocal());
    if (propuesta < hoy) {
      throw new BadRequestException(
        'La fecha propuesta no puede estar en el pasado',
      );
    }
    const minimo = textoDeColumna(fechaMinimaPropuesta(new Date(), minimos));
    if (propuesta < minimo) {
      throw new BadRequestException(
        `Propón la clase con al menos ${minimos} días de antelación (desde el ${minimo})`,
      );
    }
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
