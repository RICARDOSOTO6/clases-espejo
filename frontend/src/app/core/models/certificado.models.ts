/**
 * Certificados de la clase espejo.
 *
 * Dos pantallas comparten estos tipos: el panel de la presidencia, que diseña
 * la **plantilla** (la imagen del diseño y los tres huecos), y la clase espejo
 * del docente, que **emite** los certificados de sus alumnos a partir de ella.
 *
 * El diseño se hace **fuera** de la aplicación (Canva, Word, el programa que
 * sea) y se sube como una imagen terminada: los logos, el título, los textos
 * legales y la línea de firma van dibujados dentro de esa imagen. La plataforma
 * solo estampa los **tres datos que cambian**: el nombre del alumno, el folio y
 * el QR de verificación.
 */

/** Dónde va el texto dentro de su hueco. */
export type AlineacionCertificado = 'left' | 'center' | 'right';

/** Los datos que estampa la aplicación. */
export type ClaveCampoCertificado = 'nombre' | 'folio' | 'qr';

/** Posición y estilo de un hueco sobre el diseño. */
export interface CampoCertificado {
  /** Esquina izquierda, en píxeles de la plantilla. */
  x: number;
  /** Borde superior, en píxeles de la plantilla. */
  y: number;
  /** Ancho del hueco: lo usan la alineación y el salto de línea. */
  ancho: number;
  /**
   * Alto del hueco, en píxeles de la plantilla. Es la caja de diseño: con ella
   * se sabe si el nombre cabe (y en ella caben sus dos líneas).
   */
  alto: number;
  /** Tamaño de la letra, en puntos del PDF (el máximo del autoajuste). */
  tamano: number;
  /** Suelo del autoajuste de este hueco, en puntos del PDF. */
  tamanoMinimo: number;
  alineacion: AlineacionCertificado;
  /** Color en `#RRGGBB`. El QR lo ignora: siempre va en negro. */
  color: string;
  negrita: boolean;
  cursiva: boolean;
  /** Texto de ejemplo del diseño. No se imprime. */
  muestra: string;
}

export type CamposCertificado = Record<ClaveCampoCertificado, CampoCertificado>;

/**
 * Un problema del diseño. `grave` es lo que impide activar la plantilla (un
 * hueco fuera del papel o un nombre que no cabe); `aviso` es lo que solo hay
 * que decir (falta el diseño, la imagen sale pixelada, poco contraste…).
 */
export interface ProblemaPlantilla {
  gravedad: 'grave' | 'aviso';
  /** Dónde está: la etiqueta del dato. */
  donde: string;
  mensaje: string;
}

/** Una versión de la plantilla. Las versiones no se editan: se crean. */
export interface PlantillaCertificado {
  id: number;
  version: number;
  activa: boolean;
  fondoUrl: string | null;
  anchoPx: number;
  altoPx: number;
  campos: CamposCertificado;
  creadaPor: string | null;
  creadoEn: string;
  /** Cuántos certificados salieron ya con esta versión. */
  certificados: number;
}

/** Una entrada del catálogo de datos (lo que el panel pone en la lista). */
export interface CatalogoCampoCertificado {
  clave: ClaveCampoCertificado;
  etiqueta: string;
}

/**
 * Lo que se está editando en el panel antes de guardar. Es la versión activa
 * (o la de arranque, con `version: 0`); guardar crea una versión nueva a partir
 * de esto.
 */
export interface BorradorPlantillaCertificado {
  /** `null` mientras no exista ninguna versión guardada. */
  id: number | null;
  version: number;
  activa: boolean;
  fondoUrl: string | null;
  anchoPx: number;
  altoPx: number;
  campos: CamposCertificado;
}

/** Todo lo que devuelve la pantalla de la plantilla. */
export interface EstadoPlantillaCertificado {
  catalogo: CatalogoCampoCertificado[];
  /** Plantilla de arranque, para poder previsualizar antes de guardar nada. */
  porDefecto: Omit<
    PlantillaCertificado,
    'id' | 'version' | 'activa' | 'creadaPor' | 'creadoEn' | 'certificados'
  >;
  versiones: PlantillaCertificado[];
  activa: PlantillaCertificado | null;
}

/** Un certificado ya emitido. */
export interface CertificadoEmitido {
  id: number;
  folio: string;
  alumnoId: number;
  alumnoNombre: string;
  matricula: string;
  correo: string;
  estado: string;
  emitidoEn: string;
  anuladoMotivo: string;
  /** Para la fase 5 (envío por correo): hoy siempre vacío. */
  enviadoEn: string | null;
  enviadoA: string;
  hashSha256: string;
}

/** El estado de la sección «Certificados» de una clase espejo. */
export interface EstadoCertificados {
  proyectoId: number;
  estadoProyecto: string;
  /** Solo se puede emitir con la clase cerrada (`FINALIZADO`). */
  claseCerrada: boolean;
  /** Por qué no se puede emitir todavía (`null` si sí se puede). */
  motivoNoEmitir: string | null;
  plantilla: {
    id: number;
    version: number;
    fondoUrl: string | null;
  } | null;
  lista: {
    id: number;
    total: number;
    incluidos: number;
    sinCorreo: number;
  } | null;
  certificados: CertificadoEmitido[];
  resumen: {
    emitidos: number;
    anulados: number;
    pendientes: number;
    alumnos: number;
  };
}

/** Lo que responde la emisión. */
export interface ResultadoEmision {
  mensaje: string;
  emitidos: CertificadoEmitido[];
  reemitidos: CertificadoEmitido[];
  omitidos: { alumnoId: number; alumno: string; motivo: string }[];
  /** Cosas que hay que decir sin haber fallado (por ejemplo, un diseño WEBP). */
  avisos: string[];
}
