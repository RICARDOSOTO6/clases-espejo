/**
 * Los datos que la aplicación **estampa encima** del diseño del certificado.
 *
 * Desde esta fase el diseño se hace **fuera** de la aplicación (Canva, Word, el
 * programa que sea) y se sube como una **imagen terminada**: los logos, el
 * título, los textos legales y la línea de firma van dibujados dentro de esa
 * imagen. La plataforma solo escribe los **tres datos que cambian** en cada
 * certificado, y para eso el diseño deja tres huecos vacíos:
 *
 * 1. **`nombre`** — el nombre del alumno, con **autoajuste** de tamaño.
 * 2. **`folio`** — el código único del certificado.
 * 3. **`qr`** — el código QR que apunta a la verificación pública.
 *
 * Cada dato lleva dónde va y cómo se ve (`x`, `y`, `ancho`, `alto`, `tamano`,
 * `alineacion`, `color`, `negrita` y `cursiva`). Las coordenadas están en
 * **píxeles de la plantilla** (los de la imagen de fondo: `anchoPx` × `altoPx`)
 * y el PDF las lleva a una hoja A4 horizontal: así, cambiar el diseño por otro
 * de más resolución no descoloca nada. El tamaño de la letra va en **puntos del
 * PDF**, que es lo que entiende el generador.
 *
 * El hueco del QR **no lleva tipografía**: su `tamano`, `color`, `negrita`,
 * `cursiva` y `alineacion` se guardan por comodidad (todos los huecos comparten
 * forma) pero el generador los ignora: el QR se dibuja siempre en negro sobre
 * blanco, que es lo que hace que un teléfono lo lea.
 *
 * La definición vive en un solo sitio a propósito. De aquí leen el servicio que
 * genera el PDF, el que guarda la plantilla y el catálogo que el panel le
 * enseña a la presidencia.
 *
 * **Compatibilidad hacia atrás:** una plantilla guardada antes de esta fase
 * trae siete datos (`titulo`, `instituciones`, `fechas`, `docentes`, `firma`…).
 * `normalizarCampos` se queda con los tres que existen y rellena los que falten
 * con su sitio por defecto, así que una plantilla vieja se sigue leyendo y
 * emitiendo sin error.
 */

/** Dónde va el texto dentro de su caja. */
export const ALINEACIONES = ['left', 'center', 'right'] as const;
export type Alineacion = (typeof ALINEACIONES)[number];

/**
 * Los datos que lleva el certificado, en el orden en que se pintan. Cambiar
 * esta lista cambia a la vez el PDF, la validación y el panel.
 */
export const CLAVES_CAMPO = ['nombre', 'folio', 'qr'] as const;
export type ClaveCampo = (typeof CLAVES_CAMPO)[number];

/** A4 horizontal en puntos (1 pt = 1/72 pulgada): el tamaño de la hoja. */
export const ANCHO_PT = 841.89;
export const ALTO_PT = 595.28;

/**
 * Interlineado del certificado. Es el de `pdfkit` para una fuente TTF (1.15) y
 * la medida del lienzo tiene que usar exactamente el mismo: si divergen, la
 * vista previa mentiría sobre si el nombre cabe.
 */
export const INTERLINEADO = 1.15;

/** Rango de tamaño de letra admitido, en puntos del PDF. */
export const TAMANO_MINIMO = 8;
export const TAMANO_MAXIMO = 72;

/**
 * **Mínimo legible del nombre**, en puntos. El autoajuste baja el tamaño del
 * nombre hasta aquí, y ni un punto más: por debajo de 18 pt un nombre deja de
 * leerse bien en un A4 impreso, y un certificado que no se lee no sirve.
 *
 * Si con 18 pt el nombre todavía no cabe en una línea, el autoajuste lo parte
 * en **dos líneas** (nunca corta una palabra). Si ni así cabe, avisa al emitir
 * diciendo el nombre concreto.
 */
export const TAMANO_MINIMO_NOMBRE = 18;

/**
 * Cuánto baja el tamaño en cada paso del autoajuste, en puntos. Medio punto es
 * lo bastante fino para no desperdiciar espacio y lo bastante corto para que la
 * búsqueda sea instantánea.
 */
export const PASO_AJUSTE = 0.5;

/** Caja mínima de un hueco, en píxeles de la plantilla. */
export const ANCHO_MINIMO = 120;
export const ALTO_MINIMO = 48;

/**
 * Margen seguro: un 5 % por cada lado (que es, redondeando, el 1,5 cm que pide
 * la guía de diseño). El lienzo lo dibuja para que nada quede pegado al canto;
 * no es un límite duro, pero sí se avisa cuando un hueco entra en él.
 */
export const MARGEN_SEGURO = 0.05;

/** El lienzo de la plantilla, en píxeles (el tamaño de la imagen de fondo). */
export interface LienzoPlantilla {
  anchoPx: number;
  altoPx: number;
}

/**
 * **A4 horizontal a 300 ppp: 3508 × 2480 px**, que es el tamaño que pide la
 * guía de diseño (29,7 × 21 cm a 300 ppp, o sea 1 cm = 118,11 px). Es el lienzo
 * con el que nacen las plantillas nuevas.
 */
export const LIENZO_POR_DEFECTO: LienzoPlantilla = {
  anchoPx: 3508,
  altoPx: 2480,
};

/** Posición y estilo de un hueco sobre el diseño. */
export interface CampoCertificado {
  /** Esquina izquierda del hueco, en píxeles de la plantilla. */
  x: number;
  /** Borde superior del hueco, en píxeles de la plantilla. */
  y: number;
  /** Ancho del hueco: es lo que usan la alineación y el salto de línea. */
  ancho: number;
  /**
   * Alto del hueco, en píxeles de la plantilla. El PDF no recorta con él: es la
   * caja de diseño, con la que se sabe si el nombre cabe (y en la que caben sus
   * dos líneas). El nombre **nunca** se sale de la caja ni pierde letras.
   */
  alto: number;
  /**
   * Tamaño de la letra, en puntos del PDF. Para el nombre es el tamaño **de
   * partida**: el autoajuste solo lo baja, nunca lo sube.
   */
  tamano: number;
  /**
   * Suelo del autoajuste para este hueco, en puntos del PDF. El nombre baja
   * hasta aquí y ni un punto más (por debajo deja de leerse en papel). Se puede
   * subir si el diseño admite menos margen, pero nunca bajar del mínimo
   * absoluto ([`TAMANO_MINIMO`]) ni pasar del tamaño de partida.
   *
   * Los huecos que no se ajustan (folio y QR) lo ignoran.
   */
  tamanoMinimo: number;
  alineacion: Alineacion;
  /** Color del texto en `#RRGGBB`. El QR lo ignora: siempre va en negro. */
  color: string;
  negrita: boolean;
  cursiva: boolean;
  /**
   * El texto de ejemplo con el que se colocó el hueco. **No se imprime** (al
   * emitir se escribe el nombre real del alumno): existe para que la vista
   * previa enseñe algo parecido a lo que va a salir y para poder avisar antes
   * de emitir. Vive dentro del hueco, y no en una columna aparte, porque es un
   * dato de ese hueco y así viaja con él.
   */
  muestra: string;
}

export type CamposCertificado = Record<ClaveCampo, CampoCertificado>;

/** Etiquetas del catálogo: lo que el panel enseña como «dato». */
export const CATALOGO_CAMPOS: { clave: ClaveCampo; etiqueta: string }[] = [
  { clave: 'nombre', etiqueta: 'Nombre del alumno' },
  { clave: 'folio', etiqueta: 'Folio del certificado' },
  { clave: 'qr', etiqueta: 'Código QR de verificación' },
];

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
 * Colocación de partida sobre el A4 de la guía (3508 × 2480 px). No es un
 * diseño «bonito»: son **los tres huecos que manda la guía**, con sus medidas
 * exactas, para que la plantilla de arranque ya se pueda emitir sin colocar
 * nada a mano.
 *
 * | Hueco  | Tamaño        | Izquierda      | Arriba         |
 * | ------ | ------------- | -------------- | -------------- |
 * | nombre | 2362 × 354 px | 573 px (4,85 cm)  | 1113 px (9,42 cm)  |
 * | folio  | 709 × 94 px   | 177 px (1,5 cm)   | 2209 px (18,70 cm) |
 * | qr     | 354 × 354 px  | 2977 px (25,20 cm)| 1949 px (16,50 cm) |
 */
export const CAMPOS_POR_DEFECTO: CamposCertificado = {
  nombre: {
    x: 573,
    y: 1113,
    ancho: 2362,
    alto: 354,
    // Tamaño de partida: el nombre corto sale así de grande y el largo baja
    // solo. Con 40 pt, «Juan Pérez» llena su hueco con letra grande.
    tamano: 40,
    tamanoMinimo: TAMANO_MINIMO_NOMBRE,
    alineacion: 'center',
    color: '#12233A',
    negrita: true,
    cursiva: false,
    // Un nombre largo y con acentos a propósito: es el caso que rompe un
    // certificado mal medido, y así se ve desde el primer momento.
    muestra: 'María Fernanda de Jesús Rodríguez Villanueva',
  },
  folio: {
    x: 177,
    y: 2209,
    ancho: 709,
    alto: 94,
    // El folio no se ajusta: es un código corto de longitud fija, así que o
    // cabe o hay que agrandar el hueco. 14 pt caben de sobra en 0,8 cm.
    tamano: 14,
    tamanoMinimo: 14,
    alineacion: 'left',
    color: '#333333',
    negrita: false,
    cursiva: false,
    muestra: 'CACE-2026-0001',
  },
  qr: {
    x: 2977,
    y: 1949,
    ancho: 354,
    alto: 354,
    // El QR no lleva tipografía: estos valores solo rellenan la forma común.
    tamano: 12,
    tamanoMinimo: 12,
    alineacion: 'left',
    color: '#000000',
    negrita: false,
    cursiva: false,
    muestra: '',
  },
};

/**
 * El texto de ejemplo de un dato, para la plantilla de arranque y para los
 * flujos que no tienen un hueco guardado (por ejemplo, al emitir con una
 * plantilla vieja). Es la misma muestra que llevan los campos por defecto.
 */
export const MUESTRAS_POR_DEFECTO: Record<ClaveCampo, string> = {
  nombre: CAMPOS_POR_DEFECTO.nombre.muestra,
  folio: CAMPOS_POR_DEFECTO.folio.muestra,
  qr: '',
};

const MAXIMO_MUESTRA = 400;

/**
 * Con cuántas líneas se supone el alto de una caja que llega **sin** alto (un
 * JSON guardado antes de que existiera el alto). Se calcula con el tamaño de
 * letra de ese mismo dato, y se deja holgado a propósito: una caja de más nunca
 * dispara un aviso falso.
 */
const LINEAS_CAJA_POR_DEFECTO = 3.5;

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
 * certificado»: la pantalla ya lo limita al dibujar el hueco, y esto lo vuelve
 * a comprobar al guardar y al emitir, para que ni una fila editada a mano en la
 * base pueda sacar un dato del papel.
 */
function encajarEnLienzo<
  T extends { x: number; y: number; ancho: number; alto: number },
>(caja: T, lienzo: LienzoPlantilla): T {
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
 * La compatibilidad con las plantillas viejas sale de aquí sin ningún caso
 * especial: `CLAVES_CAMPO` tiene tres claves, así que de un JSON con los siete
 * datos antiguos se leen los tres que existen y los que falten (el QR, siempre)
 * se rellenan con su sitio por defecto. Lo que ya no se usa se ignora.
 *
 * `lienzo` es el tamaño de la plantilla. Se usa para dos cosas: encajar cada
 * caja dentro del papel y suponer el alto de una caja que llegue sin él (un
 * JSON guardado antes de que existiera el alto).
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
    const ancho = aNumero(campo['ancho'], anterior.ancho, ANCHO_MINIMO, 6000);

    salida[clave] = encajarEnLienzo(
      {
        x: aNumero(campo['x'], anterior.x, 0, 6000),
        y: aNumero(campo['y'], anterior.y, 0, 6000),
        ancho,
        // Sin `alto` (JSON viejo) se supone una caja holgada con **su** tamaño
        // de letra, no la del campo por defecto: cambiar el tamaño a mano y
        // perder el alto no debe encoger la caja. La excepción es el QR, que es
        // cuadrado por definición: si no trae alto se queda con su ancho (un
        // hueco de 3 cm de ancho y 1,2 cm de alto sacaría el QR deformado y
        // ningún teléfono lo leería).
        alto: aNumero(
          campo['alto'],
          clave === 'qr' ? ancho : altoDeLineas(tamano, LINEAS_CAJA_POR_DEFECTO, lienzo),
          ALTO_MINIMO,
          6000,
        ),
        tamano,
        // El suelo del autoajuste nunca pasa del tamaño de partida (una caja
        // configurada al revés encogería el nombre en vez de crecerlo) ni baja
        // del mínimo absoluto.
        tamanoMinimo: aNumero(
          campo['tamanoMinimo'],
          Math.min(anterior.tamanoMinimo ?? TAMANO_MINIMO_NOMBRE, tamano),
          TAMANO_MINIMO,
          tamano,
        ),
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
