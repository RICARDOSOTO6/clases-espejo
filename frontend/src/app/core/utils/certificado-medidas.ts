/**
 * Las cuentas del certificado, del lado del navegador: cuánto ocupa un texto,
 * qué tamaño le queda al nombre, si un color se va a leer sobre el diseño y qué
 * problemas tiene una plantilla.
 *
 * Existe para que **la vista previa y el PDF midan lo mismo**. Los números (el
 * A4 en puntos, el interlineado, los límites de tamaño, el mínimo legible y el
 * margen seguro) son los mismos que usa el backend en `campos-certificado.ts`;
 * si allí cambian, aquí hay que cambiarlos también, y por eso están juntos y
 * comentados.
 *
 * El texto se mide con un `canvas` de verdad, con la misma familia de fuente
 * que incrusta el PDF (Arial en Windows), así que lo que se ve en la pantalla
 * es lo que sale impreso.
 */
import {
  CampoCertificado,
  CamposCertificado,
  ClaveCampoCertificado,
  ProblemaPlantilla,
} from '../models/certificado.models';

/** A4 horizontal en puntos (1 pt = 1/72 pulgada): la hoja del PDF. */
export const ANCHO_PT = 841.89;

/** Interlineado del PDF y del lienzo: el mismo número en los dos lados. */
const INTERLINEADO = 1.15;

/** Rango de tamaño de letra admitido, en puntos del PDF. */
export const TAMANO_MINIMO = 8;
export const TAMANO_MAXIMO = 72;

/**
 * **Mínimo legible del nombre**, en puntos, y valor con el que nace un hueco.
 * El autoajuste no baja de aquí salvo que el hueco pida otra cosa, y nunca por
 * debajo de `TAMANO_MINIMO`.
 */
export const TAMANO_MINIMO_NOMBRE = 18;

/** Cuánto baja el tamaño en cada paso del autoajuste, en puntos. */
const PASO_AJUSTE = 0.5;

/** Hueco mínimo de un dato, en píxeles de la plantilla. */
const ANCHO_MINIMO = 120;
const ALTO_MINIMO = 48;

/** Margen seguro: un 5 % por cada lado (el 1,5 cm que pide la guía). */
const MARGEN_SEGURO = 0.05;

/**
 * El A4 horizontal a 300 ppp (3508 × 2480 px) que pide la guía de diseño. Por
 * debajo de esto la imagen sale pixelada al imprimir.
 */
export const LIENZO_POR_DEFECTO: LienzoPlantilla = {
  anchoPx: 3508,
  altoPx: 2480,
};

/** El lienzo de la plantilla, en píxeles (el tamaño de la imagen de fondo). */
export interface LienzoPlantilla {
  anchoPx: number;
  altoPx: number;
}

/** Una caja cualquiera del certificado, para las cuentas de posición. */
interface CajaCertificado {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  tamano: number;
  negrita: boolean;
  cursiva: boolean;
}

/** Píxeles de plantilla por punto del PDF. */
function pxPorPunto(lienzo: LienzoPlantilla): number {
  return lienzo.anchoPx / ANCHO_PT;
}

/**
 * Mete un hueco dentro del lienzo: ni se sale del papel ni se queda por debajo
 * del mínimo. Se aplica igual al dibujar el rectángulo que al moverlo.
 */
export function encajarCaja<
  T extends { x: number; y: number; ancho: number; alto: number },
>(caja: T, lienzo: LienzoPlantilla): T {
  const ancho = Math.min(lienzo.anchoPx, Math.max(ANCHO_MINIMO, Math.round(caja.ancho)));
  const alto = Math.min(lienzo.altoPx, Math.max(ALTO_MINIMO, Math.round(caja.alto)));
  return {
    ...caja,
    ancho,
    alto,
    x: Math.min(Math.max(0, Math.round(caja.x)), Math.max(0, lienzo.anchoPx - ancho)),
    y: Math.min(Math.max(0, Math.round(caja.y)), Math.max(0, lienzo.altoPx - alto)),
  };
}

/** ¿La caja cabe entera dentro del papel? */
function dentroDelLienzo(
  caja: { x: number; y: number; ancho: number; alto: number },
  lienzo: LienzoPlantilla,
): boolean {
  return (
    caja.x >= 0 &&
    caja.y >= 0 &&
    caja.x + caja.ancho <= lienzo.anchoPx &&
    caja.y + caja.alto <= lienzo.altoPx
  );
}

/** ¿La caja se mete en el margen seguro del 5 %? */
function tocaMargenSeguro(
  caja: { x: number; y: number; ancho: number; alto: number },
  lienzo: LienzoPlantilla,
): boolean {
  const margenX = lienzo.anchoPx * MARGEN_SEGURO;
  const margenY = lienzo.altoPx * MARGEN_SEGURO;
  return (
    caja.x < margenX ||
    caja.y < margenY ||
    caja.x + caja.ancho > lienzo.anchoPx - margenX ||
    caja.y + caja.alto > lienzo.altoPx - margenY
  );
}

// --- Medir texto ---

/** Un contexto de medición reutilizado: crear uno por texto sería un derroche. */
let contextoMedicion: CanvasRenderingContext2D | null | undefined;

function contexto(): CanvasRenderingContext2D | null {
  if (contextoMedicion === undefined) {
    contextoMedicion =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d');
  }
  return contextoMedicion;
}

/** La fuente de CSS que corresponde al estilo guardado (Arial y sus variantes). */
function fuenteCss(negrita: boolean, cursiva: boolean, tamanoPx: number): string {
  return `${cursiva ? 'italic ' : ''}${negrita ? '700' : '400'} ${tamanoPx}px Arial, Helvetica, sans-serif`;
}

/** Lo que mide de ancho un texto, en píxeles de la plantilla. */
function medirAncho(
  texto: string,
  estilo: { negrita: boolean; cursiva: boolean },
  tamano: number,
  lienzo: LienzoPlantilla,
): number {
  const ctx = contexto();
  const tamanoPx = tamano * pxPorPunto(lienzo);
  if (!ctx) return texto.length * tamanoPx * 0.5;
  ctx.font = fuenteCss(estilo.negrita, estilo.cursiva, tamanoPx);
  return ctx.measureText(texto).width;
}

/** Cómo queda el nombre después del autoajuste. */
interface NombreAjustado {
  lineas: string[];
  tamano: number;
  /** `true` cuando ni con el mínimo y dos líneas cabe en el hueco. */
  desborda: boolean;
}

/**
 * El autoajuste del nombre, con **el mismo criterio que el PDF**: se busca la
 * línea más grande que quepa bajando de medio punto en medio punto hasta el
 * mínimo del hueco; si no cabe en una línea, se parte en dos por los espacios
 * (nunca cortando una palabra) y, si aun así no cabe, se avisa.
 *
 * Sirve para que la vista previa enseñe el nombre al tamaño que va a salir de
 * verdad, no al tamaño de partida.
 *
 * ⚠️ **Gemelo** de `CertificadoPdfService.ajustarNombre` en
 * `backend/src/certificados/certificado-pdf.service.ts`: los dos paquetes no
 * comparten módulos, así que el criterio está escrito dos veces a propósito. Se
 * cambian los dos a la vez o la vista previa mentirá.
 */
export function ajustarNombre(
  texto: string,
  caja: Pick<CajaCertificado, 'ancho' | 'alto' | 'tamano' | 'negrita' | 'cursiva'> & {
    tamanoMinimo?: number;
  },
  lienzo: LienzoPlantilla,
): NombreAjustado {
  const nombre = (texto ?? '').trim();
  if (!nombre) return { lineas: [], tamano: caja.tamano, desborda: false };

  const suelo = Math.max(
    TAMANO_MINIMO,
    Math.min(caja.tamanoMinimo ?? TAMANO_MINIMO_NOMBRE, caja.tamano),
  );
  const altoEnPx = (tamano: number, lineas: number) =>
    tamano * pxPorPunto(lienzo) * INTERLINEADO * lineas;

  const cabeAncho = (t: string, tamano: number) =>
    medirAncho(t, caja, tamano, lienzo) <= caja.ancho + 0.5;

  const inicio = Math.max(suelo, Math.round(caja.tamano / PASO_AJUSTE) * PASO_AJUSTE);
  for (let tamano = inicio; tamano >= suelo; tamano -= PASO_AJUSTE) {
    if (cabeAncho(nombre, tamano) && altoEnPx(tamano, 1) <= caja.alto + 0.5) {
      return { lineas: [nombre], tamano: redondear(tamano), desborda: false };
    }
  }

  const partes = partirEnDos(nombre);
  if (
    partes &&
    partes.every((parte) => cabeAncho(parte, suelo)) &&
    altoEnPx(suelo, 2) <= caja.alto + 0.5
  ) {
    return { lineas: partes, tamano: suelo, desborda: false };
  }

  return { lineas: [nombre], tamano: suelo, desborda: true };
}

/**
 * Parte el nombre en dos líneas **por los espacios**, buscando el corte que
 * deja las dos mitades más parecidas. Devuelve `null` si no hay ningún hueco
 * donde cortar (un nombre de una sola palabra): partir una palabra por la mitad
 * es mutilar el nombre de una persona.
 *
 * ⚠️ **Gemelo** de `partirEnDos` en
 * `backend/src/certificados/certificado-pdf.service.ts`: los dos paquetes no
 * comparten módulos, así que el algoritmo está escrito dos veces a propósito.
 * Se cambian los dos a la vez.
 */
function partirEnDos(texto: string): [string, string] | null {
  const palabras = texto.split(/\s+/).filter(Boolean);
  if (palabras.length < 2) return null;

  let mejor: [string, string] | null = null;
  let mejorDiferencia = Infinity;
  for (let corte = 1; corte < palabras.length; corte += 1) {
    const primera = palabras.slice(0, corte).join(' ');
    const segunda = palabras.slice(corte).join(' ');
    const diferencia = Math.abs(primera.length - segunda.length);
    if (diferencia < mejorDiferencia) {
      mejorDiferencia = diferencia;
      mejor = [primera, segunda];
    }
  }
  return mejor;
}

/** Un tamaño con medio punto de precisión, sin colas de coma flotante. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// --- Contraste ---

/**
 * Luminancia relativa de un color `#RRGGBB`, con la fórmula de la WCAG 2.1 que
 * ya se usa para comprobar los temas de la CACE (ver
 * `styles.css`): cada canal se normaliza y se le aplica la curva de la
 * percepción, porque el ojo no ve igual de brillante un verde que un azul.
 */
function luminancia(color: string): number {
  const canales = aRgb(color);
  if (!canales) return 0;
  const [r, g, b] = canales.map((canal) => {
    const c = canal / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contraste entre dos colores, de 1 (nada) a 21 (negro sobre blanco). La WCAG
 * pide **4,5:1** para el texto normal y 3:1 para el texto grande: por debajo de
 * 4,5 el nombre y el folio no se leen bien en papel.
 */
export function contraste(colorA: string, colorB: string): number {
  const a = luminancia(colorA);
  const b = luminancia(colorB);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** El mínimo de la WCAG para texto normal, que es el que se avisa. */
const CONTRASTE_MINIMO = 4.5;

/** `#RRGGBB` → `[r, g, b]`, o `null` si el color no tiene esa forma. */
function aRgb(color: string): [number, number, number] | null {
  const limpio = (color ?? '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return null;
  return [
    parseInt(limpio.slice(0, 2), 16),
    parseInt(limpio.slice(2, 4), 16),
    parseInt(limpio.slice(4, 6), 16),
  ];
}

/** `[r, g, b]` → `#rrggbb`. */
export function aHex(r: number, g: number, b: number): string {
  const dos = (valor: number) =>
    Math.max(0, Math.min(255, Math.round(valor))).toString(16).padStart(2, '0');
  return `#${dos(r)}${dos(g)}${dos(b)}`;
}

// --- La revisión de la plantilla ---

/** Todo lo que hace falta para revisar una plantilla. */
interface RevisionPlantilla {
  campos: CamposCertificado;
  lienzo: LienzoPlantilla;
  /** Proporción (ancho/alto) de la imagen del diseño, si se pudo leer. */
  proporcionFondo: number | null;
  /** Tamaño real de la imagen del diseño, si se pudo leer. */
  resolucionFondo: { anchoPx: number; altoPx: number } | null;
  hayFondo: boolean;
  /** El nombre con el que se está probando la vista previa. */
  nombrePrueba: string;
  /** Color medio del diseño debajo de cada hueco, si se pudo muestrear. */
  fondosMuestreados: Partial<Record<ClaveCampoCertificado, string>>;
  /** Etiquetas del catálogo, para nombrar cada dato en los mensajes. */
  etiquetas: { clave: ClaveCampoCertificado; etiqueta: string }[];
}

/**
 * La revisión completa: los problemas **graves** (los que impiden guardar) y
 * los avisos (lo que solo hay que decir). Se calcula con el nombre de prueba que
 * está a la vista, que es el caso que se quiere comprobar.
 */
export function revisarPlantilla(revision: RevisionPlantilla): ProblemaPlantilla[] {
  const {
    campos,
    lienzo,
    proporcionFondo,
    resolucionFondo,
    hayFondo,
    nombrePrueba,
    fondosMuestreados,
    etiquetas,
  } = revision;
  const problemas: ProblemaPlantilla[] = [];

  for (const { clave, etiqueta } of etiquetas) {
    const campo = campos[clave];
    if (!campo) continue;

    if (!dentroDelLienzo(campo, lienzo)) {
      problemas.push({
        gravedad: 'grave',
        donde: etiqueta,
        mensaje:
          'Se sale del certificado. Vuelve a marcar el hueco hacia dentro: nada puede quedar fuera del papel.',
      });
      continue;
    }

    if (tocaMargenSeguro(campo, lienzo)) {
      problemas.push({
        gravedad: 'aviso',
        donde: etiqueta,
        mensaje:
          'Está dentro del margen seguro (el 5 % del borde, unos 1,5 cm): al imprimir puede quedar demasiado cerca del canto.',
      });
    }

    // El QR no lleva texto: solo se comprueba que quepa (ya hecho arriba).
    if (clave === 'qr') continue;

    if (clave === 'nombre') {
      const ajuste = ajustarNombre(nombrePrueba, campo, lienzo);
      if (ajuste.desborda) {
        problemas.push({
          gravedad: 'grave',
          donde: etiqueta,
          mensaje: `El nombre de prueba («${nombrePrueba}») no cabe ni con el mínimo (${campo.tamanoMinimo} pt) en dos líneas: agranda el hueco del nombre o baja el mínimo.`,
        });
      }
    } else if (campo.muestra?.trim()) {
      const ancho = medirAncho(campo.muestra, campo, campo.tamano, lienzo);
      if (ancho > campo.ancho + 0.5) {
        problemas.push({
          gravedad: 'grave',
          donde: etiqueta,
          mensaje: `El texto de ejemplo («${campo.muestra}») no cabe en su hueco: agrándalo o baja el tamaño de letra.`,
        });
      }
    }

    // ¿Se va a leer el texto sobre lo que hay detrás del hueco?
    const fondo = fondosMuestreados[clave];
    if (fondo) {
      const ratio = contraste(campo.color, fondo);
      if (ratio < CONTRASTE_MINIMO) {
        problemas.push({
          gravedad: 'aviso',
          donde: etiqueta,
          mensaje: `Poco contraste: el color elegido (${campo.color}) sobre el diseño (${fondo}) da ${ratio.toFixed(1)}:1 y hacen falta ${CONTRASTE_MINIMO}:1 para leerlo bien. Elige un tono más claro u oscuro, o deja el fondo del hueco más liso.`,
        });
      }
    }
  }

  if (!hayFondo) {
    problemas.push({
      gravedad: 'aviso',
      donde: 'Diseño',
      mensaje:
        'La plantilla no tiene imagen de diseño: el certificado saldrá con los datos sobre un fondo liso.',
    });
  } else {
    if (proporcionFondo !== null) {
      const esperada = lienzo.anchoPx / lienzo.altoPx;
      if (Math.abs(proporcionFondo - esperada) / esperada > 0.01) {
        problemas.push({
          gravedad: 'aviso',
          donde: 'Diseño',
          mensaje:
            'La imagen no tiene la proporción del certificado: se recorta por el centro para tapar la hoja sin deformarla (nunca se estira). Lo ideal es subirla en A4 horizontal.',
        });
      }
    }
    if (
      resolucionFondo &&
      (resolucionFondo.anchoPx < LIENZO_POR_DEFECTO.anchoPx ||
        resolucionFondo.altoPx < LIENZO_POR_DEFECTO.altoPx)
    ) {
      problemas.push({
        gravedad: 'aviso',
        donde: 'Diseño',
        mensaje: `La imagen mide ${resolucionFondo.anchoPx} × ${resolucionFondo.altoPx} px y el A4 a 300 ppp son ${LIENZO_POR_DEFECTO.anchoPx} × ${LIENZO_POR_DEFECTO.altoPx}: se agrandará para tapar la hoja y en papel saldrá pixelada.`,
      });
    }
  }

  return problemas;
}

/** ¿El color es un `#RRGGBB` de verdad? */
export function esColor(valor: unknown): valor is string {
  return typeof valor === 'string' && /^#[0-9a-fA-F]{6}$/.test(valor.trim());
}

/** Los tres estilos de tipografía de la lista corta del panel. */
export type TipografiaCertificado = 'normal' | 'negrita' | 'cursiva';

export const TIPOGRAFIAS: { valor: TipografiaCertificado; etiqueta: string }[] = [
  { valor: 'normal', etiqueta: 'Arial' },
  { valor: 'negrita', etiqueta: 'Arial negrita' },
  { valor: 'cursiva', etiqueta: 'Arial cursiva' },
];

/** El estilo guardado (`negrita`/`cursiva`) como valor de la lista corta. */
export function tipografiaDe(campo: Pick<CampoCertificado, 'negrita' | 'cursiva'>): TipografiaCertificado {
  if (campo.negrita) return 'negrita';
  if (campo.cursiva) return 'cursiva';
  return 'normal';
}

/** El valor de la lista corta como estilo guardado. */
export function estiloDeTipografia(
  tipografia: TipografiaCertificado,
): { negrita: boolean; cursiva: boolean } {
  return {
    negrita: tipografia === 'negrita',
    cursiva: tipografia === 'cursiva',
  };
}

/** Las alineaciones que ofrece el panel, con su etiqueta. */
export const ALINEACIONES: { valor: 'left' | 'center' | 'right'; etiqueta: string }[] = [
  { valor: 'left', etiqueta: 'Izquierda' },
  { valor: 'center', etiqueta: 'Centrada' },
  { valor: 'right', etiqueta: 'Derecha' },
];
