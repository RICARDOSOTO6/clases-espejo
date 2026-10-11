/**
 * Los datos que se escriben encima del fondo del certificado y los textos
 * legales, con su posición y su estilo.
 *
 * Cada dato lleva dónde va y cómo se ve (`x`, `y`, `ancho`, `alto`, `tamano`,
 * `alineacion`, `color`, `negrita` y `cursiva`). Las coordenadas están en
 * **píxeles de la plantilla** (los de la imagen de fondo: `anchoPx` × `altoPx`)
 * y el PDF las lleva a una hoja A4 horizontal: así, cambiar el fondo por otro de
 * más resolución no descoloca nada. El tamaño de la letra, en cambio, va en
 * **puntos del PDF**, que es lo que entiende el generador; el editor visual
 * convierte con `pxPorPunto`, la misma cuenta, para que el lienzo y el PDF
 * midan igual.
 *
 * La definición vive en un solo sitio a propósito. De aquí leen el servicio que
 * genera el PDF, el que guarda la plantilla y el catálogo que el panel le
 * enseña al presidente; con dos listas separadas, añadir un dato obligaría a
 * acordarse de las dos y el certificado saldría a medias.
 *
 * `alto`, `cursiva` y las muestras se añadieron al rehacer la sección como
 * editor visual (arrastrar y escribir encima, en vez de teclear números). Todo
 * es **compatible hacia atrás**: un JSON guardado antes de eso no trae esos
 * campos y aquí se rellenan con un valor razonable, nunca se descarta.
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

/** A4 horizontal en puntos (1 pt = 1/72 pulgada): el tamaño de la hoja. */
export const ANCHO_PT = 841.89;
export const ALTO_PT = 595.28;

/**
 * Interlineado del certificado. Es el de `pdfkit` para una fuente TTF (1.15) y
 * el editor tiene que usar exactamente el mismo en el CSS: si el lienzo
 * interlinea distinto que el PDF, el aviso de «no cabe» mentiría.
 */
export const INTERLINEADO = 1.15;

/** Rango de tamaño de letra admitido, en puntos del PDF. */
export const TAMANO_MINIMO = 8;
export const TAMANO_MAXIMO = 72;

/** Caja mínima de un dato, en píxeles de la plantilla. */
export const ANCHO_MINIMO = 120;
export const ALTO_MINIMO = 48;

/**
 * Margen seguro: un 5 % por cada lado. El editor lo dibuja para que nada quede
 * pegado al canto; no es un límite duro (solo el borde del lienzo lo es), pero
 * sí se avisa cuando un dato entra en él.
 */
export const MARGEN_SEGURO = 0.05;

/** El lienzo de la plantilla, en píxeles (el tamaño de la imagen de fondo). */
export interface LienzoPlantilla {
  anchoPx: number;
  altoPx: number;
}

/** El A4 de arranque, que es el que trae la tabla. */
export const LIENZO_POR_DEFECTO: LienzoPlantilla = {
  anchoPx: 2480,
  altoPx: 1748,
};

/** Posición y estilo de un dato sobre el fondo. */
export interface CampoCertificado {
  /** Esquina izquierda de la caja, en píxeles de la plantilla. */
  x: number;
  /** Borde superior de la caja, en píxeles de la plantilla. */
  y: number;
  /** Ancho de la caja: es lo que usan la alineación y el salto de línea. */
  ancho: number;
  /**
   * Alto de la caja, en píxeles de la plantilla. El PDF **no** recorta con él
   * (un nombre largo se sale antes que perder letras); es la caja de diseño,
   * la que usa el editor para saber si el texto cabe.
   */
  alto: number;
  /** Tamaño de la letra, en puntos del PDF. */
  tamano: number;
  alineacion: Alineacion;
  /** Color del texto en `#RRGGBB`. */
  color: string;
  negrita: boolean;
  cursiva: boolean;
  /**
   * El texto de ejemplo con el que el presidente colocó y midió la caja. **No
   * se imprime** (al emitir se escribe el nombre del alumno y los datos de la
   * clase de verdad): existe para que el editor pueda enseñar algo parecido a
   * lo que va a salir y avisar si no cabe. Vive dentro de la caja, y no en una
   * columna aparte, porque es un dato de esa caja y así viaja con ella.
   */
  muestra: string;
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
  alto: number;
  tamano: number;
  alineacion: Alineacion;
  color: string;
  negrita: boolean;
  cursiva: boolean;
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
 * Con cuántas líneas se supone el alto de una caja que llega **sin** alto (un
 * JSON guardado antes del editor visual). Se calcula con el tamaño de letra de
 * ese mismo dato, y se deja holgado a propósito: una caja de más nunca dispara
 * un aviso falso, y el presidente la encoge arrastrando si le sobra.
 */
const LINEAS_CAJA_POR_DEFECTO = 3.5;

/** Píxeles de plantilla por punto del PDF: el factor entre las dos medidas. */
export function pxPorPunto(lienzo: LienzoPlantilla = LIENZO_POR_DEFECTO): number {
  return lienzo.anchoPx / ANCHO_PT;
}

/** Lo que mide de alto, en píxeles de la plantilla, un texto de `lineas`. */
export function altoDeLineas(
  tamano: number,
  lineas: number,
  lienzo: LienzoPlantilla = LIENZO_POR_DEFECTO,
): number {
  return Math.round(tamano * pxPorPunto(lienzo) * INTERLINEADO * lineas);
}

/**
 * Colocación de partida sobre un A4 horizontal (2480 × 1748 px, el tamaño que
 * trae la tabla). No es una plantilla «bonita»: es un punto de partida con el
 * que se puede emitir desde el primer día, y el presidente la mueve a su gusto.
 *
 * Los tamaños están elegidos para que **el nombre de ejemplo más largo quepa** en
 * su caja: así la plantilla de arranque no nace con avisos y el aviso de «no
 * cabe» solo salta cuando de verdad se fuerza la máquina.
 */
export const CAMPOS_POR_DEFECTO: CamposCertificado = {
  titulo: {
    x: 240,
    y: 380,
    ancho: 2000,
    alto: 163,
    tamano: 24,
    alineacion: 'center',
    color: '#1F3A5F',
    negrita: true,
    cursiva: false,
    muestra: 'Clase espejo: Calidad y Pruebas de Software',
  },
  nombre: {
    x: 240,
    y: 760,
    ancho: 2000,
    alto: 190,
    tamano: 28,
    alineacion: 'center',
    color: '#12233A',
    negrita: true,
    cursiva: false,
    // El nombre de ejemplo es largo y con acentos a propósito: es el caso que
    // rompe un certificado mal medido, y así se ve desde el primer momento.
    muestra: 'María Fernanda de Jesús Rodríguez Villanueva',
  },
  instituciones: {
    x: 240,
    y: 940,
    ancho: 2000,
    alto: 95,
    tamano: 14,
    alineacion: 'center',
    color: '#333333',
    negrita: false,
    cursiva: false,
    muestra:
      'Instituto Tecnológico Superior de Calkiní (México) y Universidad Nacional de Colombia (Colombia)',
  },
  fechas: {
    x: 240,
    y: 1010,
    ancho: 2000,
    alto: 95,
    tamano: 14,
    alineacion: 'center',
    color: '#444444',
    negrita: false,
    cursiva: false,
    muestra: 'del 04 de septiembre de 2026 al 16 de octubre de 2026',
  },
  docentes: {
    x: 240,
    y: 1100,
    ancho: 2000,
    alto: 81,
    tamano: 12,
    alineacion: 'center',
    color: '#444444',
    negrita: false,
    cursiva: false,
    muestra:
      'Docentes: Sofía Gómez (Instituto Tecnológico Superior de Calkiní) · Isabella Cárdenas (Universidad Nacional de Colombia)',
  },
  firma: {
    x: 1400,
    y: 1330,
    ancho: 900,
    alto: 133,
    tamano: 16,
    alineacion: 'center',
    color: '#1F3A5F',
    negrita: true,
    cursiva: false,
    // La firma sí es contenido: el editor enseña el nombre real del presidente
    // (`firmaNombre`) y esta muestra solo se usa mientras no haya ninguno.
    muestra: '',
  },
  folio: {
    x: 160,
    y: 1470,
    ancho: 900,
    alto: 81,
    tamano: 12,
    alineacion: 'left',
    color: '#555555',
    negrita: false,
    cursiva: false,
    muestra: 'Folio: CACE-2026-0001',
  },
};

/** Un texto legal de arranque, para que un certificado nunca salga «pelado». */
export const TEXTOS_LEGALES_POR_DEFECTO: TextosLegales = [
  {
    id: 'constancia',
    texto:
      'La Comunidad de Apoyo a Clases Espejo (CACE) otorga el presente certificado como constancia de la participación del alumno en la clase espejo descrita arriba, impartida de forma conjunta por las instituciones participantes.',
    x: 240,
    y: 1530,
    ancho: 2000,
    alto: 122,
    tamano: 12,
    alineacion: 'center',
    color: '#666666',
    negrita: false,
    cursiva: false,
  },
];

/**
 * El texto de ejemplo de un dato, para la plantilla de arranque y para los
 * flujos que no tienen una caja guardada (por ejemplo, al emitir con una
 * plantilla vieja). Es la misma muestra que llevan los campos por defecto.
 */
export const MUESTRAS_POR_DEFECTO: Record<ClaveCampo, string> = {
  titulo: CAMPOS_POR_DEFECTO.titulo.muestra,
  nombre: CAMPOS_POR_DEFECTO.nombre.muestra,
  instituciones: CAMPOS_POR_DEFECTO.instituciones.muestra,
  fechas: CAMPOS_POR_DEFECTO.fechas.muestra,
  docentes: CAMPOS_POR_DEFECTO.docentes.muestra,
  firma: '',
  folio: CAMPOS_POR_DEFECTO.folio.muestra,
};

const MAXIMO_BLOQUES_LEGALES = 10;
const MAXIMO_TEXTO_LEGAL = 1200;
const MAXIMO_MUESTRA = 400;

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

function aBooleano(valor: unknown, anterior: boolean): boolean {
  return typeof valor === 'boolean' ? valor : anterior;
}

/**
 * Encierra una caja dentro del lienzo: ni se sale por ningún lado ni se queda
 * más pequeña que el mínimo. Es la red de la regla «nada se sale del
 * certificado»: el editor ya lo limita al arrastrar, y esto lo vuelve a
 * comprobar al guardar y al emitir, para que ni una fila editada a mano en la
 * base pueda sacar un dato del papel.
 */
function encajarEnLienzo<
  T extends { x: number; y: number; ancho: number; alto: number },
>(caja: T, lienzo: LienzoPlantilla): T {
  // La caja nunca es mayor que el papel (si no, no habría dónde ponerla) ni más
  // pequeña que el mínimo, y después se mete hacia dentro sin deformarla.
  const ancho = Math.min(
    lienzo.anchoPx,
    Math.max(ANCHO_MINIMO, Math.round(caja.ancho)),
  );
  const alto = Math.min(
    lienzo.altoPx,
    Math.max(ALTO_MINIMO, Math.round(caja.alto)),
  );
  return {
    ...caja,
    ancho,
    alto,
    x: Math.min(Math.max(0, Math.round(caja.x)), Math.max(0, lienzo.anchoPx - ancho)),
    y: Math.min(Math.max(0, Math.round(caja.y)), Math.max(0, lienzo.altoPx - alto)),
  };
}

/**
 * Deja los campos en la forma que espera el generador de PDF.
 *
 * Se pasa siempre un `base` (los campos anteriores o los de por defecto) y lo
 * que llega solo puede **corregir** ese base: un campo ausente, un número con
 * letras o un color mal escrito no rompen el certificado, se quedan como
 * estaban. Es la misma idea que el resto del panel: una fila editada a mano en
 * la base no debe dejar la pantalla (ni el PDF) sin datos.
 *
 * `lienzo` es el tamaño de la plantilla. Se usa para dos cosas: encajar cada
 * caja dentro del papel y suponer el alto de una caja que llegue sin él (un
 * JSON guardado antes de que existiera el editor visual).
 */
export function normalizarCampos(
  valor: unknown,
  base: CamposCertificado = CAMPOS_POR_DEFECTO,
  lienzo: LienzoPlantilla = LIENZO_POR_DEFECTO,
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

    const tamano = aNumero(
      campo['tamano'],
      anterior.tamano,
      TAMANO_MINIMO,
      TAMANO_MAXIMO,
    );

    salida[clave] = encajarEnLienzo(
      {
        x: aNumero(campo['x'], anterior.x, 0, 6000),
        y: aNumero(campo['y'], anterior.y, 0, 6000),
        ancho: aNumero(campo['ancho'], anterior.ancho, ANCHO_MINIMO, 6000),
        // Sin `alto` (JSON viejo) se supone una caja holgada con **su** tamaño
        // de letra, no la del campo por defecto: cambiar el tamaño a mano y
        // perder el alto no debe encoger la caja.
        alto: aNumero(
          campo['alto'],
          altoDeLineas(tamano, LINEAS_CAJA_POR_DEFECTO, lienzo),
          ALTO_MINIMO,
          6000,
        ),
        tamano,
        alineacion: aAlineacion(campo['alineacion'], anterior.alineacion),
        color: esColor(campo['color']) ? campo['color'].trim() : anterior.color,
        negrita: aBooleano(campo['negrita'], anterior.negrita),
        cursiva: aBooleano(campo['cursiva'], anterior.cursiva ?? false),
        muestra:
          typeof campo['muestra'] === 'string'
            ? campo['muestra'].slice(0, MAXIMO_MUESTRA)
            : (anterior.muestra ?? MUESTRAS_POR_DEFECTO[clave]),
      },
      lienzo,
    );
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
  lienzo: LienzoPlantilla = LIENZO_POR_DEFECTO,
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
    const tamano = aNumero(
      bloque['tamano'],
      anterior.tamano,
      TAMANO_MINIMO,
      TAMANO_MAXIMO,
    );

    salida.push(
      encajarEnLienzo(
        {
          id,
          texto: texto.slice(0, MAXIMO_TEXTO_LEGAL),
          x: aNumero(bloque['x'], anterior.x, 0, 6000),
          y: aNumero(bloque['y'], anterior.y, 0, 6000),
          ancho: aNumero(bloque['ancho'], anterior.ancho, ANCHO_MINIMO, 6000),
          alto: aNumero(
            bloque['alto'],
            altoDeLineas(tamano, LINEAS_CAJA_POR_DEFECTO, lienzo),
            ALTO_MINIMO,
            6000,
          ),
          tamano,
          alineacion: aAlineacion(bloque['alineacion'], anterior.alineacion),
          color: esColor(bloque['color'])
            ? bloque['color'].trim()
            : anterior.color,
          negrita: aBooleano(bloque['negrita'], anterior.negrita ?? false),
          cursiva: aBooleano(bloque['cursiva'], anterior.cursiva ?? false),
        },
        lienzo,
      ),
    );
  }
  return salida;
}

/** Cuántos bloques legales se admiten, para poder decirlo en el mensaje. */
export const maximoBloquesLegales = MAXIMO_BLOQUES_LEGALES;
export const maximoTextoLegal = MAXIMO_TEXTO_LEGAL;
export const maximoMuestra = MAXIMO_MUESTRA;
