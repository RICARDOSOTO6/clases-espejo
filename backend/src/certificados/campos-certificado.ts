/**
 * Los datos que se escriben encima del fondo del certificado y los textos
 * legales, con su posición y su estilo.
 *
 * Cada dato lleva dónde va y cómo se ve (`x`, `y`, `ancho`, `tamano`,
 * `alineacion`, `color` y `negrita`). Las coordenadas están en **píxeles de la
 * plantilla** (los de la imagen de fondo: `anchoPx` × `altoPx`) y el PDF las
 * lleva a una hoja A4 horizontal: así, cambiar el fondo por otro de más
 * resolución no descoloca nada.
 *
 * La definición vive en un solo sitio a propósito. De aquí leen el servicio que
 * genera el PDF, el que guarda la plantilla y el catálogo que el panel le
 * enseña al presidente; con dos listas separadas, añadir un dato obligaría a
 * acordarse de las dos y el certificado saldría a medias.
 */

/** Dónde va el texto dentro de su caja. */
export const ALINEACIONES = ['left', 'center', 'right'] as const;
export type Alineacion = (typeof ALINEACIONES)[number];

/**
 * Los datos que lleva el certificado, en el orden en que se pintan. Cambiar
 * esta lista cambia a la vez el PDF, la validación y el panel.
 */
export const CLAVES_CAMPO = [
  'titulo',
  'nombre',
  'instituciones',
  'fechas',
  'docentes',
  'firma',
  'folio',
] as const;
export type ClaveCampo = (typeof CLAVES_CAMPO)[number];

/** Posición y estilo de un dato sobre el fondo. */
export interface CampoCertificado {
  /** Esquina izquierda de la caja, en píxeles de la plantilla. */
  x: number;
  /** Borde superior de la caja, en píxeles de la plantilla. */
  y: number;
  /** Ancho de la caja: es lo que usan la alineación y el salto de línea. */
  ancho: number;
  /** Tamaño de la letra, en puntos del PDF (no en píxeles). */
  tamano: number;
  alineacion: Alineacion;
  /** Color del texto en `#RRGGBB`. */
  color: string;
  negrita: boolean;
}

export type CamposCertificado = Record<ClaveCampo, CampoCertificado>;

/**
 * Un párrafo legal suelto (la constancia de participación, la nota de
 * autenticidad…). Se guardan en una lista porque cada uno va en su sitio.
 */
export interface BloqueLegal {
  /** Clave estable para que el panel pueda editar la lista sin perder el foco. */
  id: string;
  texto: string;
  x: number;
  y: number;
  ancho: number;
  tamano: number;
  alineacion: Alineacion;
  color: string;
}

export type TextosLegales = BloqueLegal[];

/** Etiquetas del catálogo: lo que el panel enseña como «dato». */
export const CATALOGO_CAMPOS: { clave: ClaveCampo; etiqueta: string }[] = [
  { clave: 'titulo', etiqueta: 'Título de la clase espejo' },
  { clave: 'nombre', etiqueta: 'Nombre del alumno' },
  { clave: 'instituciones', etiqueta: 'Las dos instituciones' },
  { clave: 'fechas', etiqueta: 'Fechas de la clase' },
  { clave: 'docentes', etiqueta: 'Docentes participantes' },
  { clave: 'firma', etiqueta: 'Firma del presidente' },
  { clave: 'folio', etiqueta: 'Folio del certificado' },
];

/**
 * Colocación de partida sobre un A4 horizontal (2480 × 1748 px, el tamaño que
 * trae la tabla). No es una plantilla «bonita»: es un punto de partida con el
 * que se puede emitir desde el primer día, y el presidente la mueve a su gusto.
 */
export const CAMPOS_POR_DEFECTO: CamposCertificado = {
  titulo: {
    x: 240,
    y: 380,
    ancho: 2000,
    tamano: 32,
    alineacion: 'center',
    color: '#1F3A5F',
    negrita: true,
  },
  nombre: {
    x: 240,
    y: 760,
    ancho: 2000,
    tamano: 60,
    alineacion: 'center',
    color: '#12233A',
    negrita: true,
  },
  instituciones: {
    x: 240,
    y: 940,
    ancho: 2000,
    tamano: 24,
    alineacion: 'center',
    color: '#333333',
    negrita: false,
  },
  fechas: {
    x: 240,
    y: 1010,
    ancho: 2000,
    tamano: 22,
    alineacion: 'center',
    color: '#444444',
    negrita: false,
  },
  docentes: {
    x: 240,
    y: 1100,
    ancho: 2000,
    tamano: 20,
    alineacion: 'center',
    color: '#444444',
    negrita: false,
  },
  firma: {
    x: 1400,
    y: 1330,
    ancho: 900,
    tamano: 22,
    alineacion: 'center',
    color: '#1F3A5F',
    negrita: true,
  },
  folio: {
    x: 160,
    y: 1500,
    ancho: 900,
    tamano: 18,
    alineacion: 'left',
    color: '#555555',
    negrita: false,
  },
};

/** Un texto legal de arranque, para que un certificado nunca salga «pelado». */
export const TEXTOS_LEGALES_POR_DEFECTO: TextosLegales = [
  {
    id: 'constancia',
    texto:
      'La Comunidad de Apoyo a Clases Espejo (CACE) otorga el presente certificado como constancia de la participación del alumno en la clase espejo descrita arriba, impartida de forma conjunta por las instituciones participantes.',
    x: 240,
    y: 1520,
    ancho: 2000,
    tamano: 15,
    alineacion: 'center',
    color: '#666666',
  },
];

const MAXIMO_BLOQUES_LEGALES = 10;
const MAXIMO_TEXTO_LEGAL = 1200;

/** ¿El color es un `#RRGGBB` de verdad? Si no, se queda el anterior. */
function esColor(valor: unknown): valor is string {
  return typeof valor === 'string' && /^#[0-9a-fA-F]{6}$/.test(valor.trim());
}

function aNumero(
  valor: unknown,
  anterior: number,
  minimo: number,
  maximo: number,
): number {
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero)) return anterior;
  return Math.min(maximo, Math.max(minimo, Math.round(numero)));
}

function aAlineacion(valor: unknown, anterior: Alineacion): Alineacion {
  return (ALINEACIONES as readonly unknown[]).includes(valor)
    ? (valor as Alineacion)
    : anterior;
}

/**
 * Deja los campos en la forma que espera el generador de PDF.
 *
 * Se pasa siempre un `base` (los campos anteriores o los de por defecto) y lo
 * que llega solo puede **corregir** ese base: un campo ausente, un número con
 * letras o un color mal escrito no rompen el certificado, se quedan como
 * estaban. Es la misma idea que el resto del panel: una fila editada a mano en
 * la base no debe dejar la pantalla (ni el PDF) sin datos.
 */
export function normalizarCampos(
  valor: unknown,
  base: CamposCertificado = CAMPOS_POR_DEFECTO,
): CamposCertificado {
  const entrante =
    valor && typeof valor === 'object' && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : {};

  const salida = {} as CamposCertificado;
  for (const clave of CLAVES_CAMPO) {
    const anterior = base[clave] ?? CAMPOS_POR_DEFECTO[clave];
    const campo =
      entrante[clave] && typeof entrante[clave] === 'object'
        ? (entrante[clave] as Record<string, unknown>)
        : {};

    salida[clave] = {
      x: aNumero(campo['x'], anterior.x, 0, 6000),
      y: aNumero(campo['y'], anterior.y, 0, 6000),
      ancho: aNumero(campo['ancho'], anterior.ancho, 40, 6000),
      tamano: aNumero(campo['tamano'], anterior.tamano, 6, 200),
      alineacion: aAlineacion(campo['alineacion'], anterior.alineacion),
      color: esColor(campo['color']) ? campo['color'].trim() : anterior.color,
      negrita:
        typeof campo['negrita'] === 'boolean'
          ? campo['negrita']
          : anterior.negrita,
    };
  }
  return salida;
}

/**
 * Lo mismo para los textos legales, que además son una lista: se limpian los
 * bloques sin texto, se corta la lista a un máximo razonable y se rellena a
 * cada uno con lo que tenía el bloque de su misma clave (o con los valores de
 * por defecto, si es nuevo).
 */
export function normalizarTextosLegales(
  valor: unknown,
  base: TextosLegales = TEXTOS_LEGALES_POR_DEFECTO,
): TextosLegales {
  const lista = Array.isArray(valor) ? valor : null;
  if (!lista) return base.map((bloque) => ({ ...bloque }));

  const porId = new Map(base.map((bloque) => [bloque.id, bloque]));
  const plantilla = base[0] ?? TEXTOS_LEGALES_POR_DEFECTO[0];
  const salida: TextosLegales = [];

  for (const [indice, item] of lista.entries()) {
    if (salida.length >= MAXIMO_BLOQUES_LEGALES) break;
    const bloque =
      item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const id =
      typeof bloque['id'] === 'string' && bloque['id'].trim()
        ? bloque['id'].trim().slice(0, 40)
        : `legal-${indice + 1}`;
    const anterior = porId.get(id) ?? plantilla;
    const texto = typeof bloque['texto'] === 'string' ? bloque['texto'] : '';

    salida.push({
      id,
      texto: texto.slice(0, MAXIMO_TEXTO_LEGAL),
      x: aNumero(bloque['x'], anterior.x, 0, 6000),
      y: aNumero(bloque['y'], anterior.y, 0, 6000),
      ancho: aNumero(bloque['ancho'], anterior.ancho, 40, 6000),
      tamano: aNumero(bloque['tamano'], anterior.tamano, 6, 200),
      alineacion: aAlineacion(bloque['alineacion'], anterior.alineacion),
      color: esColor(bloque['color']) ? bloque['color'].trim() : anterior.color,
    });
  }
  return salida;
}

/** Cuántos bloques legales se admiten, para poder decirlo en el mensaje. */
export const maximoBloquesLegales = MAXIMO_BLOQUES_LEGALES;
export const maximoTextoLegal = MAXIMO_TEXTO_LEGAL;
