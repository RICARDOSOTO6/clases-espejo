/**
 * Certificados de la clase espejo (fase 4).
 *
 * Dos pantallas comparten estos tipos: el panel del presidente, que diseña la
 * **plantilla** (fondo, posiciones, textos legales y firma), y la clase espejo
 * del docente, que **emite** los certificados de sus alumnos a partir de ella.
 */

/** Dónde va el texto dentro de su caja. */
export type AlineacionCertificado = 'left' | 'center' | 'right';

/** Los datos que lleva el certificado. */
export type ClaveCampoCertificado =
  | 'titulo'
  | 'nombre'
  | 'instituciones'
  | 'fechas'
  | 'docentes'
  | 'firma'
  | 'folio';

/** Posición y estilo de un dato sobre el fondo. */
export interface CampoCertificado {
  /** Esquina izquierda, en píxeles de la plantilla. */
  x: number;
  /** Borde superior, en píxeles de la plantilla. */
  y: number;
  /** Ancho de la caja: lo usan la alineación y el salto de línea. */
  ancho: number;
  /**
   * Alto de la caja, en píxeles de la plantilla. Es la caja de diseño: con ella
   * el editor sabe si el texto cabe. El PDF no recorta con ella (un nombre
   * largo se sale antes que perder letras).
   */
  alto: number;
  /** Tamaño de la letra, en puntos del PDF. */
  tamano: number;
  alineacion: AlineacionCertificado;
  /** Color en `#RRGGBB`. */
  color: string;
  negrita: boolean;
  cursiva: boolean;
  /**
   * Texto de ejemplo con el que se diseñó la caja. No se imprime: al emitir se
   * escribe el nombre del alumno y los datos de la clase de verdad.
   */
  muestra: string;
}

export type CamposCertificado = Record<ClaveCampoCertificado, CampoCertificado>;

/** Un párrafo legal suelto, con su sitio. */
export interface BloqueLegal {
  id: string;
  texto: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  tamano: number;
  alineacion: AlineacionCertificado;
  color: string;
  negrita: boolean;
  cursiva: boolean;
}

/** Qué está seleccionado en el lienzo del editor. */
export type SeleccionCertificado =
  | { tipo: 'campo'; clave: ClaveCampoCertificado }
  | { tipo: 'legal'; id: string }
  | null;

/**
 * Un problema del diseño. `grave` es lo que impide activar la plantilla (un
 * dato fuera del papel o un texto que no cabe); `aviso` es lo que solo hay que
 * decir (falta el fondo, un dato pegado al canto…).
 */
export interface ProblemaPlantilla {
  gravedad: 'grave' | 'aviso';
  /** Dónde está: la etiqueta del dato o el párrafo legal. */
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
  textosLegales: BloqueLegal[];
  firmaNombre: string;
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
 * (o la de arranque, con `version: 0`) con los retoques del formulario encima;
 * guardar crea una versión nueva a partir de esto.
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
  textosLegales: BloqueLegal[];
  firmaNombre: string;
}

/** Todo lo que devuelve la pantalla de la plantilla. */
export interface EstadoPlantillaCertificado {
  catalogo: CatalogoCampoCertificado[];
  /** Nombre del presidente, para proponerlo como firma. */
  firmaSugerida: string;
  /** Plantilla de arranque, para poder previsualizar antes de guardar nada. */
  porDefecto: Omit<PlantillaCertificado, 'id' | 'version' | 'activa' | 'creadaPor' | 'creadoEn' | 'certificados'>;
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
    firmaNombre: string;
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
  /** Cosas que hay que decir sin haber fallado (por ejemplo, un fondo WEBP). */
  avisos: string[];
}
