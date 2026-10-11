import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { resolverUrlPublica } from '../common/url-publica';
import {
  ESTADO_BORRADO_APROBADA,
  ESTADO_BORRADO_PENDIENTE,
  ESTADO_CACE_APROBADA,
  ESTADO_CACE_RECHAZADA,
  ESTADO_CACE_VETADA,
} from '../common/estados';
import { DecisionInstitucionDto } from './dto/decision-institucion.dto';

/**
 * Panel de instituciones de la presidencia de la CACE: listar (con lo pendiente
 * primero), aprobar, rechazar, vetar y reactivar.
 *
 * El estado ante la CACE (`estadoCace`) es lo que decide si una institución
 * opera; `activa` sigue siendo el apagado operativo y aquí no se toca.
 */

/** Orden del panel: lo que espera una decisión va arriba. */
const ORDEN_ESTADO: Record<string, number> = {
  PENDIENTE: 0,
  RECHAZADA: 1,
  VETADA: 2,
  APROBADA: 3,
};

/** Etiqueta del estado para los mensajes de error y de correo. */
const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: 'pendiente de aprobación',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
  VETADA: 'vetada',
};

/**
 * Palabras que casi todas las instituciones comparten ("Universidad",
 * "Instituto", "Tecnológico"…). Al comparar nombres se quitan para que la
 * similitud se mida sobre lo que de verdad las distingue: "Tecnológico Superior
 * de Calkiní" y "Tecnológico Nacional de México" no son parecidos por compartir
 * "Tecnológico".
 */
const PALABRAS_GENERICAS = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'y',
  'e',
  'universidad',
  'universitario',
  'universitaria',
  'instituto',
  'institucion',
  'tecnologico',
  'tecnologica',
  'nacional',
  'escuela',
  'facultad',
  'colegio',
  'centro',
  'superior',
  'politecnico',
]);

@Injectable()
export class InstitucionesCaceService {
  private readonly logger = new Logger(InstitucionesCaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Todas las instituciones, con las pendientes primero. */
  async listar() {
    const instituciones = await this.prisma.institucion.findMany({
      select: {
        id: true,
        nombre: true,
        pais: true,
        codigoPais: true,
        estado: true,
        ciudad: true,
        telefono: true,
        correoInstitucional: true,
        activa: true,
        registroCompleto: true,
        estadoCace: true,
        motivoCace: true,
        logoUrl: true,
        creadoEn: true,
        revisadaEn: true,
        revisadaPor: {
          select: {
            nombres: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
        agentes: {
          select: {
            cargo: true,
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
      orderBy: { nombre: 'asc' },
    });

    // Solo las aprobadas sirven de referencia: son las que ya están dentro y con
    // las que un registro nuevo podría chocar.
    const aprobadas = instituciones.filter(
      (institucion) => institucion.estadoCace === ESTADO_CACE_APROBADA,
    );

    return instituciones
      .map((institucion) => this.aPanel(institucion, aprobadas))
      .sort(
        (a, b) =>
          (ORDEN_ESTADO[a.estadoCace] ?? 9) -
            (ORDEN_ESTADO[b.estadoCace] ?? 9) ||
          a.nombre.localeCompare(b.nombre, 'es'),
      );
  }

  /** Aprobar: la institución pasa a operar con normalidad. */
  async aprobar(usuarioId: number, id: number) {
    return this.decidir(usuarioId, id, ESTADO_CACE_APROBADA);
  }

  /** Rechazar con motivo: el registro se conserva, pero no puede operar. */
  async rechazar(usuarioId: number, id: number, dto: DecisionInstitucionDto) {
    return this.decidir(
      usuarioId,
      id,
      ESTADO_CACE_RECHAZADA,
      this.motivoObligatorio(dto, 'rechazo'),
    );
  }

  /** Vetar con motivo: la institución queda fuera y se avisa a su agente. */
  async vetar(usuarioId: number, id: number, dto: DecisionInstitucionDto) {
    return this.decidir(
      usuarioId,
      id,
      ESTADO_CACE_VETADA,
      this.motivoObligatorio(dto, 'veto'),
    );
  }

  /**
   * Reactivar: una rechazada o vetada vuelve a estar aprobada. Se avisa igual
   * que al aprobar: su agente dio por perdida la institución y tiene que saber
   * que puede volver a usarla.
   */
  async reactivar(usuarioId: number, id: number) {
    return this.decidir(usuarioId, id, ESTADO_CACE_APROBADA);
  }

  /**
   * Borrado **definitivo** de una institución rechazada.
   *
   * Es la excepción al «el registro se conserva»: existe justo para los casos en
   * los que la institución nunca llegó a operar (un duplicado, una prueba, un
   * registro basura). Por eso:
   *
   * - Solo se puede borrar lo que está **rechazado**. Una aprobada o una vetada
   *   puede tener clases en curso; una pendiente está esperando decisión.
   * - Si tiene **historia** (solicitudes, proyectos, sesiones, evidencias,
   *   listas de alumnos o usuarios que revisaron algo) se **niega**: borrarla
   *   haría perder ese historial, y para eso está precisamente el estado
   *   rechazada.
   *
   * Sin historia, se borran también sus usuarios (agentes y docentes propios) y
   * sus filas dependientes. Las **solicitudes de borrado no se borran**: la
   * relación está en `ON DELETE SET NULL` y sobreviven justo para conservar quién
   * autorizó el borrado y cuándo. Las que seguían pendientes se dan por
   * aprobadas: lo que pedían (que la institución desaparezca) acaba de ocurrir
   * con la firma de quien borra.
   */
  async eliminar(usuarioId: number, id: number) {
    const institucion = await this.prisma.institucion.findUnique({
      where: { id },
      select: { id: true, nombre: true, estadoCace: true },
    });
    if (!institucion) {
      throw new NotFoundException('Institución no encontrada');
    }
    if (institucion.estadoCace !== ESTADO_CACE_RECHAZADA) {
      throw new BadRequestException(
        `Solo se pueden borrar definitivamente las instituciones rechazadas: «${institucion.nombre}» está ${ETIQUETA_ESTADO[institucion.estadoCace] ?? institucion.estadoCace}. ` +
          'Recházala primero si de verdad quieres eliminarla.',
      );
    }

    const historia = await this.contarHistoria(id);
    if (historia.bloqueos.length > 0) {
      throw new BadRequestException(
        `No se puede borrar «${institucion.nombre}»: tiene historia (${historia.bloqueos.join(', ')}). ` +
          'Déjala como rechazada: borrarla haría perder ese historial.',
      );
    }

    await this.borrarSinHistoria(usuarioId, id);

    return {
      mensaje: `Institución «${institucion.nombre}» eliminada definitivamente`,
      id: institucion.id,
      nombre: institucion.nombre,
    };
  }

  /**
   * Cuenta lo que hace que una institución tenga historia. Devuelve las frases
   * ya redactadas para el mensaje de error (vacío = se puede borrar).
   */
  private async contarHistoria(
    id: number,
  ): Promise<{ bloqueos: string[]; usuarios: number[] }> {
    // Los usuarios propios: sus agentes y los docentes que están en ella.
    const [agentes, docentesInstitucion] = await Promise.all([
      this.prisma.agenteInternacionalizacion.findMany({
        where: { institucionId: id },
        select: { usuarioId: true },
      }),
      this.prisma.docenteInstitucion.findMany({
        where: { institucionId: id },
        select: { docente: { select: { usuarioId: true } } },
      }),
    ]);
    const usuarios = [
      ...agentes.map((agente) => agente.usuarioId),
      ...docentesInstitucion.map((di) => di.docente.usuarioId),
    ];

    // Todo lo que cuelga de una solicitud en la que participa la institución,
    // sea como destino, como materia destino o por cualquiera de sus docentes.
    const solicitudesDeLaInstitucion = {
      OR: [
        { institucionDestinoId: id },
        { materiaDestino: { institucionId: id } },
        { asignacionOrigen: { docenteInstitucion: { institucionId: id } } },
        { asignacionDestino: { docenteInstitucion: { institucionId: id } } },
      ],
    };

    const [solicitudes, proyectos, sesiones, evidencias, listas, revisiones] =
      await Promise.all([
        this.prisma.solicitudClaseEspejo.count({
          where: solicitudesDeLaInstitucion,
        }),
        this.prisma.proyectoClaseEspejo.count({
          where: { solicitud: solicitudesDeLaInstitucion },
        }),
        this.prisma.sesion.count({
          where: { proyecto: { solicitud: solicitudesDeLaInstitucion } },
        }),
        this.prisma.evidencia.count({
          where: { proyecto: { solicitud: solicitudesDeLaInstitucion } },
        }),
        this.prisma.listaAlumnos.count({
          where: {
            OR: [
              { institucionId: id },
              { subidaPorUsuarioId: { in: usuarios.length ? usuarios : [-1] } },
            ],
          },
        }),
        this.prisma.revisionSolicitud.count({
          where: { agente: { institucionId: id } },
        }),
      ]);

    const bloqueos: string[] = [];
    if (solicitudes > 0) bloqueos.push(`${solicitudes} solicitud(es)`);
    if (proyectos > 0) bloqueos.push(`${proyectos} clase(s) espejo`);
    if (sesiones > 0) bloqueos.push(`${sesiones} sesión(es)`);
    if (evidencias > 0) bloqueos.push(`${evidencias} evidencia(s)`);
    if (listas > 0) bloqueos.push(`${listas} lista(s) de alumnos`);
    if (revisiones > 0) bloqueos.push(`${revisiones} revisión(es)`);

    return { bloqueos, usuarios };
  }

  /**
   * Borra la institución sin historia: sus usuarios y sus filas dependientes.
   * Las referencias que otros guardan a estos usuarios (`revisadaPor`,
   * `confirmadoPor`) están en `ON DELETE SET NULL`, así que la base las deja en
   * blanco sola.
   *
   * `usuarioId` es quien borra (la presidencia): queda escrito en las
   * solicitudes de borrado pendientes que esta eliminación resuelve.
   */
  private async borrarSinHistoria(
    usuarioId: number,
    id: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Asignaciones de sus materias y de sus propios docentes.
      await tx.asignacionDocente.deleteMany({
        where: {
          OR: [
            { materia: { institucionId: id } },
            { docenteInstitucion: { institucionId: id } },
          ],
        },
      });
      await tx.materia.deleteMany({ where: { institucionId: id } });
      await tx.invitacion.deleteMany({ where: { institucionId: id } });
      await tx.listaAlumnos.deleteMany({ where: { institucionId: id } });

      // Las solicitudes de borrado **no** se borran: sobreviven a la institución
      // (`ON DELETE SET NULL`) con quién las pidió, el motivo y —en las ya
      // resueltas— quién autorizó y cuándo. Las que seguían pendientes se dan por
      // aprobadas aquí: pedían justo esto, y la firma es la de quien borra. Si no
      // se cerraran, quedarían pendientes para siempre apuntando a nada.
      await tx.solicitudBorradoInstitucion.updateMany({
        where: { institucionId: id, estado: ESTADO_BORRADO_PENDIENTE },
        data: {
          estado: ESTADO_BORRADO_APROBADA,
          resueltaPorUsuarioId: usuarioId,
          resueltaEn: new Date(),
        },
      });

      // Docentes propios: solo se borran los que no están en otra institución.
      const vinculos = await tx.docenteInstitucion.findMany({
        where: { institucionId: id },
        select: { docenteId: true },
      });
      await tx.docenteInstitucion.deleteMany({ where: { institucionId: id } });
      for (const docenteId of new Set(vinculos.map((v) => v.docenteId))) {
        const restantes = await tx.docenteInstitucion.count({
          where: { docenteId },
        });
        if (restantes > 0) continue;
        const docente = await tx.docente.findUnique({
          where: { id: docenteId },
          select: { usuarioId: true },
        });
        await tx.docente.delete({ where: { id: docenteId } });
        if (docente) {
          await tx.usuario.delete({ where: { id: docente.usuarioId } });
        }
      }

      // Agentes de la institución: se van con ella.
      const agentes = await tx.agenteInternacionalizacion.findMany({
        where: { institucionId: id },
        select: { usuarioId: true },
      });
      await tx.agenteInternacionalizacion.deleteMany({
        where: { institucionId: id },
      });
      for (const agente of agentes) {
        // Un usuario con fila de docente no es solo agente: no se borra a ciegas.
        const docente = await tx.docente.findUnique({
          where: { usuarioId: agente.usuarioId },
          select: { id: true },
        });
        if (docente) continue;
        await tx.usuario.delete({ where: { id: agente.usuarioId } });
      }

      await tx.institucion.delete({ where: { id } });
    });
  }

  /**
   * Cambia el estado ante la CACE dejando registrado **quién** lo decidió y
   * **cuándo**, y avisa por correo al agente de la institución.
   */
  private async decidir(
    usuarioId: number,
    id: number,
    estado: string,
    motivo = '',
  ) {
    const institucion = await this.prisma.institucion.findUnique({
      where: { id },
      select: { id: true, nombre: true, estadoCace: true },
    });
    if (!institucion) {
      throw new NotFoundException('Institución no encontrada');
    }
    if (institucion.estadoCace === estado) {
      throw new BadRequestException(
        `La institución «${institucion.nombre}» ya está ${ETIQUETA_ESTADO[estado] ?? estado}.`,
      );
    }

    const actualizada = await this.prisma.institucion.update({
      where: { id },
      data: {
        estadoCace: estado,
        motivoCace: motivo,
        revisadaPorUsuarioId: usuarioId,
        revisadaEn: new Date(),
      },
      select: {
        id: true,
        nombre: true,
        estadoCace: true,
        motivoCace: true,
        revisadaEn: true,
        revisadaPor: {
          select: {
            nombres: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
        agentes: {
          select: {
            cargo: true,
            usuario: { select: { correo: true } },
          },
        },
      },
    });

    await this.avisarPorCorreo(
      actualizada.nombre,
      actualizada.agentes,
      estado,
      motivo,
    );

    return {
      mensaje: `Institución ${ETIQUETA_ESTADO[estado] ?? estado}`,
      id: actualizada.id,
      nombre: actualizada.nombre,
      estadoCace: actualizada.estadoCace,
      motivoCace: actualizada.motivoCace,
      revisadaEn: actualizada.revisadaEn,
      revisadaPor: this.nombreCompleto(actualizada.revisadaPor),
    };
  }

  /** El motivo del rechazo y del veto es obligatorio; solo espacios no vale. */
  private motivoObligatorio(
    dto: DecisionInstitucionDto,
    decision: 'rechazo' | 'veto',
  ): string {
    const motivo = dto?.motivo?.trim();
    if (!motivo) {
      throw new BadRequestException(
        decision === 'rechazo'
          ? 'Indica el motivo del rechazo'
          : 'Indica el motivo del veto',
      );
    }
    return motivo;
  }

  /**
   * Avisa a los agentes de la institución. Un fallo del correo **no** deshace la
   * decisión (ya está guardada): se anota en el log y el panel sigue.
   */
  private async avisarPorCorreo(
    nombre: string,
    agentes: { usuario: { correo: string } }[],
    estado: string,
    motivo: string,
  ): Promise<void> {
    const correos = agentes
      .map((agente) => agente.usuario.correo)
      .filter(Boolean);
    if (correos.length === 0) {
      this.logger.warn(
        `La institución «${nombre}» no tiene agente con correo: no se pudo avisar de la decisión.`,
      );
      return;
    }

    const urlPublica = resolverUrlPublica();
    for (const correo of correos) {
      try {
        if (estado === ESTADO_CACE_RECHAZADA) {
          await this.mail.sendInstitucionRechazada(
            correo,
            nombre,
            motivo,
            urlPublica,
          );
        } else if (estado === ESTADO_CACE_VETADA) {
          await this.mail.sendInstitucionVetada(
            correo,
            nombre,
            motivo,
            urlPublica,
          );
        } else {
          await this.mail.sendInstitucionAprobada(correo, nombre, urlPublica);
        }
        this.logger.log(
          `Aviso de institución ${ETIQUETA_ESTADO[estado] ?? estado} enviado a ${correo} («${nombre}»).`,
        );
      } catch (error) {
        this.logger.error(
          `No se pudo avisar a ${correo} de la decisión sobre «${nombre}»: ${this.mensajeDe(error)}`,
        );
      }
    }
  }

  /** Fila del panel: datos, agente de contacto, revisión y posible duplicado. */
  private aPanel(
    institucion: {
      id: number;
      nombre: string;
      pais: string;
      logoUrl: string | null;
      estadoCace: string;
      motivoCace: string;
      revisadaEn: Date | null;
      revisadaPor: {
        nombres: string;
        apellidoPaterno: string;
        apellidoMaterno: string;
      } | null;
      agentes: {
        cargo: string;
        usuario: {
          nombres: string;
          apellidoPaterno: string;
          apellidoMaterno: string;
          correo: string;
        };
      }[];
    },
    aprobadas: { id: number; nombre: string; pais: string }[],
  ) {
    const duplicado = aprobadas.find(
      (otra) =>
        otra.id !== institucion.id &&
        this.seParecen(
          institucion.nombre,
          institucion.pais,
          otra.nombre,
          otra.pais,
        ),
    );

    return {
      id: institucion.id,
      nombre: institucion.nombre,
      pais: institucion.pais,
      logoUrl: institucion.logoUrl,
      estadoCace: institucion.estadoCace,
      motivoCace: institucion.motivoCace,
      revisadaEn: institucion.revisadaEn,
      revisadaPor: this.nombreCompleto(institucion.revisadaPor),
      agentes: institucion.agentes.map((agente) => ({
        nombre: this.nombreCompleto(agente.usuario),
        correo: agente.usuario.correo,
        cargo: agente.cargo,
      })),
      posibleDuplicadoDe: duplicado
        ? { id: duplicado.id, nombre: duplicado.nombre, pais: duplicado.pais }
        : null,
    };
  }

  /**
   * ¿Dos instituciones se llaman "casi" igual en el mismo país? Basta con que el
   * nombre y el país se parezcan: es un **aviso** para que el presidente mire,
   * no una comprobación que decida por él.
   */
  private seParecen(
    nombreA: string,
    paisA: string,
    nombreB: string,
    paisB: string,
  ): boolean {
    if (
      !this.normalizar(paisA) ||
      this.normalizar(paisA) !== this.normalizar(paisB)
    ) {
      return false;
    }

    const a = this.nombreSignificativo(nombreA);
    const b = this.nombreSignificativo(nombreB);
    if (a.length < 4 || b.length < 4) return false;
    if (a === b) return true;

    // Uno de los dos nombres contiene al otro ("… de Colombia" y "… de Colombia
    // Sede Medellín").
    const palabrasA = new Set(a.split(' '));
    const palabrasB = new Set(b.split(' '));
    const contenida = [...palabrasA].every((palabra) => palabrasB.has(palabra))
      ? true
      : [...palabrasB].every((palabra) => palabrasA.has(palabra));
    if (contenida) return true;

    return this.similitud(a, b) >= 0.6;
  }

  /**
   * Nombre sin palabras genéricas. Si al quitarlas no queda nada (por ejemplo
   * "Universidad Nacional"), se usa el nombre completo: comparar cadenas vacías
   * marcaría como duplicado cualquier pareja del mismo país.
   */
  private nombreSignificativo(nombre: string): string {
    const completo = this.normalizar(nombre);
    const palabras = completo
      .split(' ')
      .filter((palabra) => !PALABRAS_GENERICAS.has(palabra));
    return palabras.length > 0 ? palabras.join(' ') : completo;
  }

  /** Minúsculas, sin acentos y sin signos, para comparar lo escrito a mano. */
  private normalizar(texto: string): string {
    return (texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Coeficiente de Dice sobre pares de letras (0 = nada, 1 = idénticos). */
  private similitud(a: string, b: string): number {
    const pares = (texto: string): string[] => {
      const limpio = texto.replace(/\s/g, '');
      const lista: string[] = [];
      for (let i = 0; i < limpio.length - 1; i++) {
        lista.push(limpio.slice(i, i + 2));
      }
      return lista;
    };

    const paresA = pares(a);
    const paresB = pares(b);
    if (paresA.length === 0 || paresB.length === 0) return 0;

    const copia = [...paresB];
    let coincidencias = 0;
    for (const par of paresA) {
      const indice = copia.indexOf(par);
      if (indice >= 0) {
        coincidencias++;
        copia.splice(indice, 1);
      }
    }
    return (2 * coincidencias) / (paresA.length + paresB.length);
  }

  private nombreCompleto(
    usuario: {
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
    } | null,
  ): string | null {
    if (!usuario) return null;
    return `${usuario.nombres} ${usuario.apellidoPaterno} ${usuario.apellidoMaterno}`.trim();
  }

  private mensajeDe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
