import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { basename, join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateInstitucionDto } from './dto/update-institucion.dto';
import { ESTADO_CACE_APROBADA } from '../common/estados';
import { estadoHabilitacion } from '../common/institucion-habilitada';

/** Carpeta donde se guardan los logos (dentro de `uploads`). */
export const LOGOS_DIR = join(process.cwd(), 'uploads', 'instituciones');

@Injectable()
export class InstitucionesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Catálogo de destinos. Solo aparecen las instituciones **aprobadas por la
   * CACE**: una pendiente, rechazada o vetada no puede recibir clases espejo, y
   * ofrecerla como destino sería dejar al docente proponer algo imposible.
   */
  async listar(usuarioId: number) {
    const propias = await this.institucionesPropias(usuarioId);
    return this.prisma.institucion.findMany({
      where: {
        activa: true,
        registroCompleto: true,
        estadoCace: ESTADO_CACE_APROBADA,
        id: { notIn: propias },
      },
      select: {
        id: true,
        nombre: true,
        pais: true,
        codigoPais: true,
        estado: true,
        ciudad: true,
        telefono: true,
        correoInstitucional: true,
        logoUrl: true,
        registroCompleto: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Directorio para el **registro**: quien va a darse de alta busca aquí su
   * institución antes de crear una nueva, para no duplicarla.
   *
   * Es público (el registro lo es) y por eso devuelve lo mínimo para
   * reconocerla: nombre, país y logo. Van **todos** los estados, incluidas las
   * rechazadas y vetadas, porque el registro se conserva justo para que nadie
   * vuelva a inscribirlas: así el formulario puede decir «esta no admite
   * registros» en vez de dejar que se cree un duplicado.
   */
  async directorio(texto?: string) {
    const q = (texto ?? '').trim();
    return this.prisma.institucion.findMany({
      where: q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { pais: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        nombre: true,
        pais: true,
        logoUrl: true,
        estadoCace: true,
      },
      orderBy: { nombre: 'asc' },
      take: 50,
    });
  }

  /** La institución del agente, con lo que le falta para poder operar. */
  async obtenerMia(usuarioId: number) {
    const agente = await this.getAgente(usuarioId);
    const institucion = await this.prisma.institucion.findUnique({
      where: { id: agente.institucionId },
    });
    if (!institucion) {
      throw new NotFoundException('Institución no encontrada');
    }
    return this.conHabilitacion(institucion, agente);
  }

  /**
   * Completar los datos de la institución. Es lo **único** que puede hacer un
   * agente cuyo alta no está confirmada o cuya institución no está aprobada.
   */
  async actualizarMia(usuarioId: number, dto: UpdateInstitucionDto) {
    const agente = await this.getAgente(usuarioId);
    const institucion = await this.prisma.institucion.update({
      where: { id: agente.institucionId },
      data: {
        nombre: dto.nombre,
        pais: dto.pais,
        codigoPais: dto.codigoPais,
        estado: dto.estado,
        ciudad: dto.ciudad,
        telefono: dto.telefono,
        correoInstitucional: dto.correoInstitucional,
        registroCompleto: true,
      },
    });
    return this.conHabilitacion(institucion, agente);
  }

  /**
   * Guarda el logo recién subido y borra el anterior, igual que se hace con la
   * foto de perfil, para no dejar archivos huérfanos en el disco.
   */
  async guardarLogo(usuarioId: number, archivo: { filename: string }) {
    const administrador = await this.getAdministradorInstitucion(usuarioId);
    const actual = await this.prisma.institucion.findUnique({
      where: { id: administrador.institucionId },
      select: { logoUrl: true },
    });
    if (!actual) throw new NotFoundException('Institución no encontrada');

    const institucion = await this.prisma.institucion.update({
      where: { id: administrador.institucionId },
      data: { logoUrl: `/logos/${archivo.filename}` },
    });

    borrarLogo(actual.logoUrl);
    return administrador.agente
      ? this.conHabilitacion(institucion, administrador.agente)
      : institucion;
  }

  /** Quita el logo de la institución y borra el archivo del disco. */
  async quitarLogo(usuarioId: number) {
    const administrador = await this.getAdministradorInstitucion(usuarioId);
    const actual = await this.prisma.institucion.findUnique({
      where: { id: administrador.institucionId },
      select: { logoUrl: true },
    });
    if (!actual) throw new NotFoundException('Institución no encontrada');

    await this.prisma.institucion.update({
      where: { id: administrador.institucionId },
      data: { logoUrl: null },
    });
    borrarLogo(actual.logoUrl);

    return { mensaje: 'Logo de la institución eliminado', logoUrl: null };
  }

  async listarMaterias(id: number) {
    // Solo instituciones publicadas y aprobadas: igual que el listado general.
    const institucion = await this.prisma.institucion.findFirst({
      where: {
        id,
        activa: true,
        registroCompleto: true,
        estadoCace: ESTADO_CACE_APROBADA,
      },
      select: { id: true },
    });
    if (!institucion) {
      throw new NotFoundException('Institución no encontrada');
    }
    return this.prisma.materia.findMany({
      where: { institucionId: id, activa: true },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Añade a la institución si su agente puede operar y, si no, **por qué**. Lo
   * usan el aviso del panel y los mensajes de bloqueo del servidor.
   */
  private conHabilitacion<
    T extends { nombre: string; estadoCace: string; motivoCace: string },
  >(institucion: T, agente: { confirmadoEn: Date | null }) {
    return {
      ...institucion,
      confirmadoEn: agente.confirmadoEn,
      ...estadoHabilitacion(institucion, agente),
    };
  }

  private async getAgente(usuarioId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede gestionar su institución',
      );
    }
    return agente;
  }

  /**
   * Para el logo también vale la secretaría activa: es parte del perfil
   * administrativo que puede mantener, sin heredar el resto del panel de agente.
   */
  private async getAdministradorInstitucion(usuarioId: number): Promise<{
    institucionId: number;
    agente: { institucionId: number; confirmadoEn: Date | null } | null;
  }> {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
      select: { institucionId: true, confirmadoEn: true },
    });
    if (agente) return { institucionId: agente.institucionId, agente };

    const secretaria = await this.prisma.secretariaInstitucion.findUnique({
      where: { usuarioId },
      select: { institucionId: true, activo: true },
    });
    if (secretaria?.activo) {
      return { institucionId: secretaria.institucionId, agente: null };
    }

    throw new UnauthorizedException(
      'Solo el agente principal o la secretaría activa pueden gestionar el logo de la institución',
    );
  }

  private async institucionesPropias(usuarioId: number): Promise<number[]> {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (agente) return [agente.institucionId];

    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
      include: { instituciones: true },
    });
    if (docente) return docente.instituciones.map((di) => di.institucionId);

    return [];
  }
}

/**
 * Borra un logo del disco. `basename` evita que una ruta manipulada salga de la
 * carpeta de logos.
 */
function borrarLogo(logoUrl: string | null): void {
  if (!logoUrl) return;
  const ruta = join(LOGOS_DIR, basename(logoUrl));
  if (!existsSync(ruta)) return;
  try {
    unlinkSync(ruta);
  } catch {
    // Si el archivo está en uso, la petición no debe fallar por eso.
  }
}
