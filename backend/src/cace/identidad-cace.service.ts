import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { basename, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { TEMA_CACE_POR_DEFECTO, esTemaCaceValido } from '../common/temas-cace';
import {
  borrarImagen,
  nombreArchivoLegible,
  tipoDocumentoReal,
} from '../common/imagenes';
import { ActualizarConfiguracionCaceDto } from './dto/configuracion-cace.dto';
import {
  ActualizarPaisComunidadDto,
  CrearPaisComunidadDto,
} from './dto/pais-comunidad.dto';
import { ActualizarPremioDto, CrearPremioDto } from './dto/premio.dto';

/** Carpeta donde vive el logo de la CACE (dentro de `uploads`). */
export const LOGOS_CACE_DIR = join(process.cwd(), 'uploads', 'cace');

/** Carpeta de las imágenes de los premios (dentro de `uploads`). */
export const IMAGENES_PREMIO_DIR = join(process.cwd(), 'uploads', 'premios');

/**
 * Carpeta de los **certificados** de los premios. Va aparte de las imágenes
 * porque un certificado es un documento que se descarga, no una pieza que se
 * pinta: así no se sirve como archivo estático (no está bajo `/premios`) y solo
 * sale por su ruta de la API, que comprueba que el premio esté publicado y le
 * pone su nombre y su tipo.
 */
export const CERTIFICADOS_PREMIO_DIR = join(
  process.cwd(),
  'uploads',
  'premios-certificados',
);

/**
 * URL con la que se sirve el certificado de un premio. Es lo que se guarda en
 * `certificadoUrl` y lo que devuelve el listado público, de modo que el enlace
 * del premio publicado ya es directamente el documento.
 */
export function urlCertificadoPremio(archivo: string): string {
  return `/cace/premios/certificado/${archivo}`;
}

/**
 * Clave de comparación alfabética de un país: sin acentos, sin mayúsculas y sin
 * depender del signo. «Perú» y «peru» dan la misma clave, que es lo que hace
 * que la lista se lea en el orden que espera una persona y que el buscador del
 * panel encuentre «Perú» escribiendo «peru».
 */
export function claveAlfabeticaPais(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

/**
 * Países en orden alfabético por nombre, sin distinguir mayúsculas ni acentos.
 *
 * Se ordena en memoria y no con `orderBy` de Prisma porque la base no sabe
 * comparar «África» con «america»: un `ORDER BY nombre` pondría todas las
 * mayúsculas y los acentos en su propio bloque, que es justo el defecto que se
 * quería quitar. La lista es de decenas de filas, así que el coste es nulo.
 * El desempate por nombre exacto evita que dos países iguales cambien de sitio
 * entre dos peticiones (el `sort` de JavaScript es estable, pero el orden de
 * llegada de la base no está garantizado sin `orderBy`).
 */
export function ordenarPaises<T extends { nombre: string }>(paises: T[]): T[] {
  return [...paises].sort((a, b) => {
    const comparacion = claveAlfabeticaPais(a.nombre).localeCompare(
      claveAlfabeticaPais(b.nombre),
      'es',
    );
    return comparacion !== 0
      ? comparacion
      : a.nombre.localeCompare(b.nombre, 'es');
  });
}

/** Premios: los más recientes primero y luego la prioridad que elige la CACE. */
const ORDEN_PREMIOS = [
  { anio: 'desc' as const },
  { orden: 'asc' as const },
  { id: 'asc' as const },
];

/**
 * Identidad de la CACE (fase 3): los textos, el logo, el tema, las banderas de
 * la comunidad y los premios.
 *
 * Vive aparte de `CaceService` (que es el alta automática de la presidencia) y
 * de `InstitucionesCaceService` (que es la aprobación de instituciones): son
 * tres trabajos distintos y mezclarlos dejaría un servicio de mil líneas.
 *
 * Lo que se lee **sin sesión** (`configuracionPublica` y `premiosPublicados`)
 * solo devuelve lo que ya es público por definición: el lema, la descripción,
 * el logo, el tema, los países activos y los premios publicados.
 */
@Injectable()
export class IdentidadCaceService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Configuración (una sola fila) ---

  /**
   * La fila única de `CONFIGURACION_CACE`.
   *
   * La tabla es de una sola fila por diseño, así que no hay una clave fija que
   * buscar: se coge la primera y, si la tabla está vacía, se crea vacía aquí
   * mismo. Esa es la razón de que el presidente pueda abrir la pantalla de
   * personalización con la base recién migrada.
   */
  private async filaConfiguracion() {
    const actual = await this.prisma.configuracionCace.findFirst({
      orderBy: { id: 'asc' },
    });
    if (actual) return actual;
    return this.prisma.configuracionCace.create({ data: {} });
  }

  /** Lo que necesita la pantalla de acceso antes de que nadie entre. */
  async configuracionPublica() {
    const config = await this.filaConfiguracion();
    return {
      lema: config.lema,
      descripcion: config.descripcion,
      logoUrl: config.logoUrl,
      tema: esTemaCaceValido(config.tema) ? config.tema : TEMA_CACE_POR_DEFECTO,
      paises: await this.listarPaisesActivos(),
    };
  }

  /** La fila completa, para el formulario del panel de la presidencia. */
  async obtenerConfiguracion() {
    return this.aConfiguracion(await this.filaConfiguracion());
  }

  /**
   * Guarda lema, descripción y tema. Solo se escribe lo que llega: en un `PATCH`
   * un campo ausente significa «no lo toques», no «bórralo» (si no, cambiar el
   * tema borraría el lema).
   */
  async actualizarConfiguracion(
    usuarioId: number,
    dto: ActualizarConfiguracionCaceDto,
  ) {
    const actual = await this.filaConfiguracion();

    const config = await this.prisma.configuracionCace.update({
      where: { id: actual.id },
      data: {
        ...(dto.lema !== undefined ? { lema: dto.lema.trim() } : {}),
        ...(dto.descripcion !== undefined
          ? { descripcion: dto.descripcion.trim() }
          : {}),
        ...(dto.tema !== undefined ? { tema: dto.tema } : {}),
        // Queda constancia de quién cambió la imagen de la CACE.
        actualizadoPorUsuarioId: usuarioId,
      },
    });

    return this.aConfiguracion(config);
  }

  /**
   * Guarda el logo recién subido y borra el anterior, igual que el logo de la
   * institución: si no, la carpeta se llena de archivos que ya nadie usa.
   */
  async guardarLogo(usuarioId: number, archivo: { filename: string }) {
    const actual = await this.filaConfiguracion();
    const config = await this.prisma.configuracionCace.update({
      where: { id: actual.id },
      data: {
        logoUrl: `/cace-logo/${archivo.filename}`,
        actualizadoPorUsuarioId: usuarioId,
      },
    });
    borrarImagen(LOGOS_CACE_DIR, actual.logoUrl);
    return this.aConfiguracion(config);
  }

  /** Quita el logo y borra el archivo: la aplicación vuelve al logo de respaldo. */
  async quitarLogo(usuarioId: number) {
    const actual = await this.filaConfiguracion();
    await this.prisma.configuracionCace.update({
      where: { id: actual.id },
      data: { logoUrl: null, actualizadoPorUsuarioId: usuarioId },
    });
    borrarImagen(LOGOS_CACE_DIR, actual.logoUrl);
    return { mensaje: 'Logo de la CACE eliminado', logoUrl: null };
  }

  /**
   * Deja la fila en la forma que espera el frontend. El tema pasa por
   * `esTemaCaceValido` porque la columna es un texto: si alguien editara la
   * base a mano y dejara un tema inexistente, la aplicación se quedaría sin
   * colores en lugar de caer al tema por defecto.
   */
  private aConfiguracion(config: {
    lema: string;
    descripcion: string;
    logoUrl: string | null;
    tema: string;
    actualizadoEn: Date;
  }) {
    return {
      lema: config.lema,
      descripcion: config.descripcion,
      logoUrl: config.logoUrl,
      tema: esTemaCaceValido(config.tema) ? config.tema : TEMA_CACE_POR_DEFECTO,
      actualizadoEn: config.actualizadoEn,
    };
  }

  // --- Banderas de la comunidad ---

  /**
   * Todos los países, activos e inactivos: es la lista del panel.
   *
   * Va en orden alfabético por nombre (sin acentos ni mayúsculas), igual que la
   * lista pública. No se ordena por la columna `orden`: ese campo ya no se
   * edita desde la interfaz y su valor histórico no debe alterar el orden.
   */
  async listarPaises() {
    return ordenarPaises(
      await this.prisma.paisComunidad.findMany({ orderBy: { id: 'asc' } }),
    );
  }

  /**
   * Solo los activos. Es lo que ve la sección «Comunidad» de docentes y agentes
   * (y la pantalla de acceso): desactivar un país lo saca de las banderas sin
   * borrarlo, que es lo que se quiere cuando un país deja la comunidad.
   *
   * Es también lo que devuelve `GET /cace/publico`, así que el orden con el que
   * se guardó cada fila no importa: se entrega alfabético.
   */
  async listarPaisesActivos() {
    return ordenarPaises(
      await this.prisma.paisComunidad.findMany({
        where: { activo: true },
        orderBy: { id: 'asc' },
      }),
    );
  }

  async crearPais(dto: CrearPaisComunidadDto) {
    return this.prisma.paisComunidad.create({
      data: {
        // Se guarda en mayúsculas porque el código arma la bandera.
        codigo: dto.codigo.trim().toUpperCase(),
        nombre: dto.nombre.trim(),
        activo: dto.activo ?? true,
      },
    });
  }

  async actualizarPais(id: number, dto: ActualizarPaisComunidadDto) {
    await this.exigirPais(id);
    return this.prisma.paisComunidad.update({
      where: { id },
      data: {
        ...(dto.codigo !== undefined
          ? { codigo: dto.codigo.trim().toUpperCase() }
          : {}),
        ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  async eliminarPais(id: number) {
    const pais = await this.exigirPais(id);
    await this.prisma.paisComunidad.delete({ where: { id } });
    return { mensaje: `País ${pais.nombre} eliminado de la comunidad`, id };
  }

  private async exigirPais(id: number) {
    const pais = await this.prisma.paisComunidad.findUnique({ where: { id } });
    if (!pais) throw new NotFoundException('País no encontrado');
    return pais;
  }

  // --- Premios y reconocimientos ---

  /**
   * Todos los premios, para el panel. Devuelve además las instituciones
   * aprobadas porque el formulario las ofrece en un desplegable y la secretaría
   * **no** puede listar instituciones por la ruta de aprobación (esa capacidad
   * es solo de la presidencia).
   */
  async listarPremios() {
    const [premios, instituciones] = await Promise.all([
      this.prisma.premio.findMany({
        include: { institucion: { select: { id: true, nombre: true } } },
        orderBy: ORDEN_PREMIOS,
      }),
      this.prisma.institucion.findMany({
        where: { activa: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    return {
      premios: premios.map((premio) => this.aPremio(premio)),
      instituciones,
    };
  }

  /** Solo los publicados: es lo que sale en Comunidad y en la portada. */
  async listarPremiosPublicados() {
    const premios = await this.prisma.premio.findMany({
      where: { publicado: true },
      include: { institucion: { select: { id: true, nombre: true } } },
      orderBy: ORDEN_PREMIOS,
    });
    return premios.map((premio) => this.aPremio(premio));
  }

  async crearPremio(dto: CrearPremioDto) {
    await this.exigirInstitucion(dto.institucionId);
    const premio = await this.prisma.premio.create({
      data: {
        titulo: dto.titulo.trim(),
        tipo: dto.tipo ?? 'RECONOCIMIENTO',
        descripcion: dto.descripcion?.trim() ?? '',
        anio: dto.anio,
        otorgadoA: dto.otorgadoA.trim(),
        fuenteNombre: dto.fuenteNombre?.trim() ?? '',
        fuenteUrl: dto.fuenteUrl?.trim() || null,
        institucionId: dto.institucionId ?? null,
        orden: dto.orden ?? 0,
        publicado: dto.publicado ?? false,
      },
      include: { institucion: { select: { id: true, nombre: true } } },
    });
    return this.aPremio(premio);
  }

  async actualizarPremio(id: number, dto: ActualizarPremioDto) {
    await this.exigirPremio(id);
    await this.exigirInstitucion(dto.institucionId);

    const premio = await this.prisma.premio.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.descripcion !== undefined
          ? { descripcion: dto.descripcion.trim() }
          : {}),
        ...(dto.anio !== undefined ? { anio: dto.anio } : {}),
        ...(dto.otorgadoA !== undefined
          ? { otorgadoA: dto.otorgadoA.trim() }
          : {}),
        ...(dto.fuenteNombre !== undefined
          ? { fuenteNombre: dto.fuenteNombre.trim() }
          : {}),
        ...(dto.fuenteUrl !== undefined
          ? { fuenteUrl: dto.fuenteUrl?.trim() || null }
          : {}),
        // `null` quita la institución; ausente, no se toca.
        ...(dto.institucionId !== undefined
          ? { institucionId: dto.institucionId }
          : {}),
        ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
        ...(dto.publicado !== undefined ? { publicado: dto.publicado } : {}),
      },
      include: { institucion: { select: { id: true, nombre: true } } },
    });
    return this.aPremio(premio);
  }

  /** Borra el premio, su imagen y su certificado: un huérfano no sirve a nadie. */
  async eliminarPremio(id: number) {
    const premio = await this.exigirPremio(id);
    await this.prisma.premio.delete({ where: { id } });
    borrarImagen(IMAGENES_PREMIO_DIR, premio.imagenUrl);
    borrarImagen(CERTIFICADOS_PREMIO_DIR, premio.certificadoUrl);
    return { mensaje: `Premio «${premio.titulo}» eliminado`, id };
  }

  async guardarImagenPremio(id: number, archivo: { filename: string }) {
    const premio = await this.exigirPremio(id);
    const actualizado = await this.prisma.premio.update({
      where: { id },
      data: { imagenUrl: `/premios/${archivo.filename}` },
      include: { institucion: { select: { id: true, nombre: true } } },
    });
    borrarImagen(IMAGENES_PREMIO_DIR, premio.imagenUrl);
    return this.aPremio(actualizado);
  }

  async quitarImagenPremio(id: number) {
    const premio = await this.exigirPremio(id);
    const actualizado = await this.prisma.premio.update({
      where: { id },
      data: { imagenUrl: null },
      include: { institucion: { select: { id: true, nombre: true } } },
    });
    borrarImagen(IMAGENES_PREMIO_DIR, premio.imagenUrl);
    return this.aPremio(actualizado);
  }

  // --- Certificado del premio (el documento que lo acredita) ---

  /**
   * Guarda el certificado recién subido y borra el anterior.
   *
   * En `certificadoUrl` se guarda la ruta con la que se **sirve** el documento
   * (`/cace/premios/certificado/<archivo>`, con un nombre de archivo aleatorio),
   * no la ruta interna del disco: así el listado público ya devuelve el enlace
   * que hay que abrir, y el archivo no queda expuesto como estático.
   */
  async guardarCertificadoPremio(
    id: number,
    archivo: { filename: string; originalname: string },
  ) {
    const premio = await this.exigirPremio(id);
    const actualizado = await this.prisma.premio.update({
      where: { id },
      data: {
        certificadoUrl: urlCertificadoPremio(archivo.filename),
        certificadoNombre: nombreArchivoLegible(archivo.originalname),
      },
      include: { institucion: { select: { id: true, nombre: true } } },
    });
    borrarImagen(CERTIFICADOS_PREMIO_DIR, premio.certificadoUrl);
    return this.aPremio(actualizado);
  }

  /** Quita el certificado: el premio se queda sin documento que acreditar. */
  async quitarCertificadoPremio(id: number) {
    const premio = await this.exigirPremio(id);
    const actualizado = await this.prisma.premio.update({
      where: { id },
      data: { certificadoUrl: null, certificadoNombre: '' },
      include: { institucion: { select: { id: true, nombre: true } } },
    });
    borrarImagen(CERTIFICADOS_PREMIO_DIR, premio.certificadoUrl);
    return this.aPremio(actualizado);
  }

  /**
   * El certificado listo para enviarlo al navegador.
   *
   * Solo se entrega si el premio está **publicado**: un borrador no es público
   * y su certificado tampoco. El archivo se resuelve por el nombre que va en la
   * URL (con `basename`, para que una ruta manipulada no salga de la carpeta) y
   * el tipo se lee del contenido, no de la extensión.
   */
  async certificadoDescargable(archivo: string) {
    const nombre = basename(archivo);
    const premio = await this.prisma.premio.findFirst({
      where: { certificadoUrl: urlCertificadoPremio(nombre), publicado: true },
      select: { certificadoNombre: true },
    });
    if (!premio) throw new NotFoundException('Certificado no encontrado');

    const ruta = join(CERTIFICADOS_PREMIO_DIR, nombre);
    if (!existsSync(ruta)) {
      throw new NotFoundException('Certificado no encontrado');
    }

    return {
      // Si el nombre original se perdiera, se ofrece el del archivo.
      nombre: premio.certificadoNombre || nombre,
      tipo: tipoDocumentoReal(ruta) ?? 'application/octet-stream',
      buffer: readFileSync(ruta),
    };
  }

  private async exigirPremio(id: number) {
    const premio = await this.prisma.premio.findUnique({ where: { id } });
    if (!premio) throw new NotFoundException('Premio no encontrado');
    return premio;
  }

  /**
   * Comprueba la institución antes de guardar. Sin esto, un id inventado lo
   * frenaría la clave foránea con un mensaje genérico de «datos relacionados»;
   * aquí se puede decir exactamente qué pasa.
   */
  private async exigirInstitucion(institucionId?: number | null) {
    if (institucionId === undefined || institucionId === null) return;
    const institucion = await this.prisma.institucion.findUnique({
      where: { id: institucionId },
      select: { id: true },
    });
    if (!institucion) {
      throw new BadRequestException('La institución indicada no existe');
    }
  }

  /** Aplana la institución a su nombre: el panel y la web solo pintan el nombre. */
  private aPremio(premio: {
    id: number;
    titulo: string;
    tipo: string;
    descripcion: string;
    anio: number;
    otorgadoA: string;
    fuenteNombre: string;
    fuenteUrl: string | null;
    institucionId: number | null;
    imagenUrl: string | null;
    certificadoUrl: string | null;
    certificadoNombre: string;
    orden: number;
    publicado: boolean;
    actualizadoEn: Date;
    institucion?: { nombre: string } | null;
  }) {
    return {
      id: premio.id,
      titulo: premio.titulo,
      tipo: premio.tipo,
      descripcion: premio.descripcion,
      anio: premio.anio,
      otorgadoA: premio.otorgadoA,
      fuenteNombre: premio.fuenteNombre,
      fuenteUrl: premio.fuenteUrl,
      institucionId: premio.institucionId,
      institucionNombre: premio.institucion?.nombre ?? null,
      imagenUrl: premio.imagenUrl,
      certificadoUrl: premio.certificadoUrl,
      certificadoNombre: premio.certificadoNombre,
      orden: premio.orden,
      publicado: premio.publicado,
      actualizadoEn: premio.actualizadoEn,
    };
  }
}
