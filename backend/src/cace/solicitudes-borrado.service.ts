import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InstitucionesCaceService } from './instituciones-cace.service';
import { rolDeUsuario } from '../auth/capacidades.guard';
import { puede } from '../common/capacidades';
import { nombreCompleto } from '../common/nombre-completo';
import {
  ESTADO_BORRADO_APROBADA,
  ESTADO_BORRADO_PENDIENTE,
  ESTADO_BORRADO_RECHAZADA,
  ESTADO_CACE_RECHAZADA,
} from '../common/estados';
import {
  ResolverSolicitudBorradoDto,
  SolicitarBorradoInstitucionDto,
} from './dto/solicitud-borrado.dto';

/**
 * Borrado de instituciones **con autorización del presidente** (fase 6).
 *
 * El presidente puede borrar directamente una institución rechazada
 * (`DELETE /cace/instituciones/:id`). La secretaría no: lo que puede es
 * **pedirlo** con un motivo, y el presidente aprueba o rechaza. Así el borrado
 * deja de ser un botón suelto y pasa a tener responsable: quien lo autoriza
 * queda escrito en la propia solicitud.
 *
 * Al aprobar no se inventa un camino nuevo: se llama al mismo borrado directo,
 * que se niega si la institución no está rechazada o si tiene historia.
 */

/** Etiqueta del estado, para los mensajes. */
const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: 'pendiente',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
};

/** La institución, tal como la devuelve Prisma con la selección de abajo. */
type InstitucionDeSolicitud = {
  id: number;
  nombre: string;
  pais: string;
  estadoCace: string;
  motivoCace: string;
};

type UsuarioDeSolicitud = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo: string;
};

type SolicitudConRelaciones = {
  id: number;
  /**
   * Puede ser `null`: la solicitud **sobrevive** al borrado de su institución
   * (`ON DELETE SET NULL`), que es justo para lo que existe la tabla (conservar
   * quién autorizó el borrado y cuándo).
   */
  institucionId: number | null;
  motivo: string;
  estado: string;
  resueltaEn: Date | null;
  creadoEn: Date;
  /** `null` cuando la institución ya se borró. */
  institucion: InstitucionDeSolicitud | null;
  solicitadaPor: UsuarioDeSolicitud;
  resueltaPor: UsuarioDeSolicitud | null;
};

@Injectable()
export class SolicitudesBorradoService {
  private readonly logger = new Logger(SolicitudesBorradoService.name);

  constructor(
    private readonly prisma: PrismaService,
    /** El borrado definitivo en sí: es el mismo que usa el presidente. */
    private readonly instituciones: InstitucionesCaceService,
  ) {}

  /**
   * La secretaría pide el borrado de una institución.
   *
   * Solo tiene sentido sobre una **rechazada** (una aprobada o vetada puede
   * tener clases en curso, y una pendiente está esperando decisión) y no puede
   * haber dos peticiones vivas sobre la misma institución: el presidente no
   * sabría cuál resolver.
   */
  async pedir(
    usuarioId: number,
    institucionId: number,
    dto: SolicitarBorradoInstitucionDto,
  ) {
    const motivo = (dto?.motivo ?? '').trim();
    if (!motivo) {
      throw new BadRequestException(
        'Indica el motivo por el que hay que borrar la institución: el presidente decide sobre él.',
      );
    }

    const institucion = await this.prisma.institucion.findUnique({
      where: { id: institucionId },
      select: { id: true, nombre: true, estadoCace: true },
    });
    if (!institucion) {
      throw new NotFoundException('Institución no encontrada');
    }
    if (institucion.estadoCace !== ESTADO_CACE_RECHAZADA) {
      throw new BadRequestException(
        `Solo se puede pedir el borrado de una institución rechazada: «${institucion.nombre}» está ${(institucion.estadoCace ?? '').toLowerCase()}. ` +
          'Recházala primero si de verdad hay que eliminarla.',
      );
    }

    const pendiente = await this.prisma.solicitudBorradoInstitucion.findFirst({
      where: { institucionId, estado: ESTADO_BORRADO_PENDIENTE },
      select: { id: true, creadoEn: true },
    });
    if (pendiente) {
      throw new BadRequestException(
        `Ya hay una solicitud de borrado pendiente para «${institucion.nombre}» (del ${pendiente.creadoEn.toISOString().slice(0, 10)}). ` +
          'El presidente tiene que resolverla antes de que se pueda pedir otra.',
      );
    }

    const solicitud = await this.prisma.solicitudBorradoInstitucion.create({
      data: {
        institucionId,
        solicitadaPorUsuarioId: usuarioId,
        motivo,
        estado: ESTADO_BORRADO_PENDIENTE,
      },
      select: this.seleccion(),
    });

    this.logger.log(
      `Solicitud de borrado ${solicitud.id} para «${institucion.nombre}» pedida por el usuario ${usuarioId}.`,
    );

    return {
      mensaje: `Solicitud enviada: la presidencia tiene que autorizar el borrado de «${institucion.nombre}».`,
      solicitud: this.aFila(solicitud),
    };
  }

  /**
   * Listado de solicitudes. El presidente ve todo (las pendientes primero y el
   * historial); la secretaría, solo las suyas. Las instituciones rechazadas se
   * devuelven a quien puede pedir el borrado, para que no tenga que entrar en un
   * panel de instituciones que no le corresponde.
   */
  async listar(usuarioId: number) {
    const cuenta = await rolDeUsuario(this.prisma, usuarioId);
    const puedeResolver = puede(cuenta?.rol, 'resolverSolicitudesBorrado');
    const puedeSolicitar = puede(cuenta?.rol, 'solicitarBorradoInstitucion');

    const solicitudes = await this.prisma.solicitudBorradoInstitucion.findMany({
      where: puedeResolver ? {} : { solicitadaPorUsuarioId: usuarioId },
      select: this.seleccion(),
    });

    const rechazadas = puedeSolicitar
      ? await this.prisma.institucion.findMany({
          where: { estadoCace: ESTADO_CACE_RECHAZADA },
          select: {
            id: true,
            nombre: true,
            pais: true,
            motivoCace: true,
            solicitudesBorrado: {
              where: { estado: ESTADO_BORRADO_PENDIENTE },
              select: { id: true },
            },
          },
          orderBy: { nombre: 'asc' },
        })
      : [];

    // Las pendientes primero (son las que esperan una decisión) y, dentro de
    // cada grupo, la más reciente arriba.
    const orden: Record<string, number> = {
      PENDIENTE: 0,
      RECHAZADA: 1,
      APROBADA: 2,
    };

    return {
      solicitudes: solicitudes
        .map((solicitud) => this.aFila(solicitud))
        .sort(
          (a, b) =>
            (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) ||
            b.creadoEn.localeCompare(a.creadoEn),
        ),
      institucionesRechazadas: rechazadas.map((institucion) => ({
        id: institucion.id,
        nombre: institucion.nombre,
        pais: institucion.pais,
        motivoCace: institucion.motivoCace,
        solicitudPendienteId: institucion.solicitudesBorrado[0]?.id ?? null,
      })),
      pendientes: solicitudes.filter(
        (s) => s.estado === ESTADO_BORRADO_PENDIENTE,
      ).length,
      puedeResolver,
      puedeSolicitar,
    };
  }

  /**
   * El presidente aprueba o rechaza.
   *
   * Al aprobar: se deja constancia de quién autoriza y cuándo, y se ejecuta el
   * borrado (el mismo que hace el presidente a mano, con sus reglas). Si el
   * borrado se niega —no está rechazada o tiene historia— la solicitud vuelve a
   * quedar pendiente y el motivo del rechazo es el que dio el borrado.
   */
  async resolver(
    usuarioId: number,
    solicitudId: number,
    dto: ResolverSolicitudBorradoDto,
  ) {
    const solicitud = await this.prisma.solicitudBorradoInstitucion.findUnique({
      where: { id: solicitudId },
      select: this.seleccion(),
    });
    if (!solicitud) {
      throw new NotFoundException('Solicitud de borrado no encontrada');
    }
    if (solicitud.estado !== ESTADO_BORRADO_PENDIENTE) {
      throw new BadRequestException(
        `Esa solicitud ya está ${ETIQUETA_ESTADO[solicitud.estado] ?? solicitud.estado}: cada solicitud se resuelve una sola vez.`,
      );
    }

    if (dto.aprobar !== true) {
      const motivo = (dto?.motivo ?? '').trim();
      if (!motivo) {
        throw new BadRequestException(
          'Indica el motivo del rechazo: quien pidió el borrado tiene que saber por qué no se hace.',
        );
      }

      const actualizada = await this.prisma.solicitudBorradoInstitucion.update({
        where: { id: solicitudId },
        data: {
          estado: ESTADO_BORRADO_RECHAZADA,
          motivo,
          resueltaPorUsuarioId: usuarioId,
          resueltaEn: new Date(),
        },
        select: this.seleccion(),
      });

      const nombre = solicitud.institucion?.nombre;
      return {
        mensaje: nombre
          ? `Solicitud rechazada: «${nombre}» sigue como rechazada y no se ha borrado nada.`
          : 'Solicitud rechazada: no se ha borrado nada. La institución de esa petición ya no existe, así que no quedaba nada que borrar.',
        solicitud: this.aFila(actualizada),
      };
    }

    // --- Aprobación ---

    // Sin institución no hay nada que borrar: la fila sobrevive al borrado de la
    // suya (`ON DELETE SET NULL`) y puede quedarse apuntando a nada. No se llama
    // al borrado con un `null` ni se da la solicitud por ejecutada: se explica, y
    // el rechazo es la salida para cerrarla.
    const institucionId = solicitud.institucionId;
    if (institucionId === null) {
      throw new BadRequestException(
        'La institución de esa solicitud ya no existe (se borró por otra vía), así que no queda nada que borrar. Recházala para cerrarla.',
      );
    }
    /** El nombre para los mensajes: la institución aún existe, se borra aquí. */
    const nombre = solicitud.institucion?.nombre ?? `#${institucionId}`;

    const resueltaEn = new Date();
    const resolutor = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        correo: true,
      },
    });
    const resueltaPor = resolutor
      ? nombreCompleto(resolutor)
      : 'Presidencia de la CACE';

    // Constancia primero: la solicitud queda APROBADA con quién la autorizó y
    // cuándo. El borrado que viene después **no se lleva esta fila**: la relación
    // está en `ON DELETE SET NULL`, así que la solicitud sobrevive sin institución
    // conservando lo que la hace valiosa (quién la autorizó, cuándo, quién la pidió
    // y con qué motivo). Con `!solicitud.institucion` el panel enseña «Institución
    // borrada» en vez de inventarse un nombre.
    await this.prisma.solicitudBorradoInstitucion.update({
      where: { id: solicitudId },
      data: {
        estado: ESTADO_BORRADO_APROBADA,
        resueltaPorUsuarioId: usuarioId,
        resueltaEn,
      },
    });

    let resultado: { archivada?: boolean };
    try {
      // Mismas reglas que el borrado directo. Sin historial se borra; con
      // historial queda archivada e inoperable, sin perder nada.
      resultado = await this.instituciones.eliminar(usuarioId, institucionId);
    } catch (error) {
      // No se pudo ejecutar: la solicitud vuelve a quedar pendiente para que la
      // presidencia pueda mirarla.
      await this.prisma.solicitudBorradoInstitucion.update({
        where: { id: solicitudId },
        data: {
          estado: ESTADO_BORRADO_PENDIENTE,
          resueltaPorUsuarioId: null,
          resueltaEn: null,
        },
      });
      throw error;
    }

    const archivada = resultado.archivada === true;

    this.logger.warn(
      `Solicitud de borrado ${solicitudId} aprobada por ${resueltaPor} (usuario ${usuarioId}) el ${resueltaEn.toISOString()}: ` +
        (archivada
          ? `se archivó «${nombre}» (institución ${institucionId}); la solicitud se conserva.`
          : `se borró definitivamente «${nombre}» (institución ${institucionId}); la solicitud se conserva.`),
    );

    return {
      mensaje: archivada
        ? `Solicitud aprobada: «${nombre}» quedó archivada e inoperable con todo su historial. La solicitud se conserva con quién la autorizó y cuándo.`
        : `Solicitud aprobada: «${nombre}» se eliminó definitivamente con tu autorización. La solicitud se conserva en el historial con quién la autorizó y cuándo.`,
      solicitud: {
        ...this.aFila({
          ...solicitud,
          estado: ESTADO_BORRADO_APROBADA,
          resueltaPor: resolutor,
          resueltaEn,
        }),
        institucionBorrada: !archivada,
        institucionArchivada: archivada,
      },
    };
  }

  /** Selección común: la solicitud con su institución y quiénes la tocaron. */
  private seleccion() {
    return {
      id: true,
      institucionId: true,
      motivo: true,
      estado: true,
      resueltaEn: true,
      creadoEn: true,
      institucion: {
        select: {
          id: true,
          nombre: true,
          pais: true,
          estadoCace: true,
          motivoCace: true,
        },
      },
      solicitadaPor: {
        select: {
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          correo: true,
        },
      },
      resueltaPor: {
        select: {
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          correo: true,
        },
      },
    } as const;
  }

  /** Fila del panel, ya redactada para la interfaz. */
  private aFila(solicitud: SolicitudConRelaciones) {
    // La institución puede ya no existir: la fila de la solicitud se conserva
    // tras su borrado (`ON DELETE SET NULL`) para dejar constancia de quién
    // autorizó qué y cuándo. Cuando falta, los datos de la institución van en
    // `null` y la interfaz escribe «Institución borrada»: no se inventa nada.
    const institucion = solicitud.institucion;
    return {
      id: solicitud.id,
      institucionId: solicitud.institucionId,
      institucionNombre: institucion?.nombre ?? null,
      institucionPais: institucion?.pais ?? null,
      estadoInstitucion: institucion?.estadoCace ?? null,
      motivoInstitucion: institucion?.motivoCace ?? null,
      motivo: solicitud.motivo,
      estado: solicitud.estado,
      solicitadaPor: nombreCompleto(solicitud.solicitadaPor),
      solicitadaPorCorreo: solicitud.solicitadaPor.correo,
      // En ISO: la interfaz las formatea y el orden de la lista se apoya en
      // compararlas como texto (que en ISO es el orden cronológico).
      creadoEn: solicitud.creadoEn.toISOString(),
      resueltaPor: solicitud.resueltaPor
        ? nombreCompleto(solicitud.resueltaPor)
        : null,
      resueltaEn: solicitud.resueltaEn
        ? solicitud.resueltaEn.toISOString()
        : null,
    };
  }
}
