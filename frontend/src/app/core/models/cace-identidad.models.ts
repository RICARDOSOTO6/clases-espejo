import { TemaCace, TipoReconocimiento } from '../constants/cace';

/**
 * Identidad de la CACE tal como la devuelve el servidor.
 *
 * Los tipos viven aquí, y no dentro del servicio, porque los comparten cuatro
 * pantallas (panel de la CACE, portada del acceso, docente y agente) y así
 * ninguna tiene que importar el servicio solo por un tipo.
 */

/** País miembro de la comunidad (fila de `PAIS_COMUNIDAD`). */
export interface PaisComunidad {
  id: number;
  /** ISO 3166-1 alpha-2: es lo que arma la bandera. */
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

/** Lo mínimo para pintar una bandera: sirve para el API y para el respaldo. */
export interface PaisBandera {
  codigo: string;
  nombre: string;
}

/** Configuración completa, para el formulario del panel. */
export interface ConfiguracionCace {
  lema: string;
  descripcion: string;
  logoUrl: string | null;
  tema: TemaCace;
  actualizadoEn?: string;
}

/** Lo que devuelve `GET /cace/publico` (sin sesión). */
export interface CacePublico {
  lema: string;
  descripcion: string;
  logoUrl: string | null;
  tema: TemaCace;
  /** Solo los países activos, ya ordenados. */
  paises: PaisComunidad[];
}

/** Premio o reconocimiento. */
export interface Premio {
  id: number;
  titulo: string;
  tipo: TipoReconocimiento;
  descripcion: string;
  anio: number;
  otorgadoA: string;
  fuenteNombre: string;
  fuenteUrl: string | null;
  institucionId: number | null;
  /** Nombre de la institución, ya resuelto por el servidor. */
  institucionNombre: string | null;
  /** Pieza de exhibición: la imagen que se ve en el carrusel. */
  imagenUrl: string | null;
  /**
   * Certificado opcional del premio. Se sirve por una ruta de la API
   * (`/cace/premios/certificado/…`) que solo entrega los de premios publicados,
   * con su `Content-Type` y su nombre para descargar.
   */
  certificadoUrl: string | null;
  /** Nombre del archivo del certificado, para ofrecerlo al descargarlo. */
  certificadoNombre: string;
  orden: number;
  publicado: boolean;
  actualizadoEn?: string;
}

/** Institución para el desplegable del formulario de premios. */
export interface InstitucionOpcion {
  id: number;
  nombre: string;
}

/**
 * Respuesta de `GET /cace/premios`: los premios y las instituciones del
 * formulario. Van juntos porque la secretaría puede publicar premios pero
 * **no** listar instituciones por la ruta de aprobación.
 */
export interface PremiosCace {
  premios: Premio[];
  instituciones: InstitucionOpcion[];
}

/** Cuerpo de `PATCH /cace/configuracion` (solo lo que cambia). */
export interface ConfiguracionCaceDto {
  lema?: string;
  descripcion?: string;
  tema?: TemaCace;
}

/** Cuerpo de alta o edición de un país de la comunidad. */
export interface PaisComunidadDto {
  codigo?: string;
  nombre?: string;
  orden?: number;
  activo?: boolean;
}

/** Cuerpo de alta o edición de un premio. */
export interface PremioDto {
  titulo?: string;
  tipo?: TipoReconocimiento;
  descripcion?: string;
  anio?: number;
  otorgadoA?: string;
  fuenteNombre?: string;
  fuenteUrl?: string | null;
  institucionId?: number | null;
  orden?: number;
  publicado?: boolean;
}
