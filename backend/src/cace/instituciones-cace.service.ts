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
