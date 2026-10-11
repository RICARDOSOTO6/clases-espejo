/**
 * Las cuentas del certificado, del lado del navegador: cuánto ocupa un texto,
 * si cabe en su caja y qué problemas tiene una plantilla.
 *
 * Existe para que **el lienzo y el PDF midan lo mismo**. Los números (el A4 en
 * puntos, el interlineado, los límites de tamaño y el margen seguro) son los
 * mismos que usa el backend en `campos-certificado.ts`; si allí cambian, aquí
 * hay que cambiarlos también, y por eso están juntos y comentados.
 *
 * El texto se mide con un `canvas` de verdad, con la misma familia de fuente
 * que incrusta el PDF (Arial en Windows), así que el aviso de «no cabe» salta
 * en el mismo sitio en el que el papel se desbordaría.
 */
import {
  BloqueLegal,
  CamposCertificado,
  ClaveCampoCertificado,
  ProblemaPlantilla,
} from '../models/certificado.models';

/** A4 horizontal en puntos (1 pt = 1/72 pulgada): la hoja del PDF. */
export const ANCHO_PT = 841.89;
export const ALTO_PT = 595.28;

/** Interlineado del PDF y del lienzo: el mismo número en los dos lados. */
export const INTERLINEADO = 1.15;

/** Rango de tamaño de letra admitido, en puntos del PDF. */
export const TAMANO_MINIMO = 8;
export const TAMANO_MAXIMO = 72;

/** Caja mínima de un dato, en píxeles de la plantilla. */
export const ANCHO_MINIMO = 120;
export const ALTO_MINIMO = 48;

/** Margen seguro: un 5 % por cada lado, dibujado como guía en el lienzo. */
export const MARGEN_SEGURO = 0.05;

/** El lienzo de la plantilla, en píxeles (el tamaño de la imagen de fondo). */
export interface LienzoPlantilla {
  anchoPx: number;
  altoPx: number;
}

/** Una caja cualquiera del certificado, para las cuentas de posición. */
export interface CajaCertificado {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  tamano: number;
  negrita: boolean;
  cursiva: boolean;
}

/** Píxeles de plantilla por punto del PDF. */
export function pxPorPunto(lienzo: LienzoPlantilla): number {
  return lienzo.anchoPx / ANCHO_PT;
}

/** Lo que mide de alto, en píxeles de la plantilla, un texto de `lineas`. */
export function altoDeLineas(
  tamano: number,
  lineas: number,
  lienzo: LienzoPlantilla,
): number {
  return Math.round(tamano * pxPorPunto(lienzo) * INTERLINEADO * lineas);
}

/**
 * Mete una caja dentro del lienzo: ni se sale del papel ni se queda por debajo
 * del mínimo. Es la regla que el usuario pidió («los campos no se pueden sacar
 * del lienzo»), y se aplica igual al arrastrar que al redimensionar.
 */
export function encajarCaja<T extends { x: number; y: number; ancho: number; alto: number }>(
  caja: T,
  lienzo: LienzoPlantilla,
): T {
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
export function dentroDelLienzo(
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
export function tocaMargenSeguro(
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

/** El resultado de medir un texto dentro de una caja. */
export interface MedidaTexto {
  lineas: number;
  /** Lo que ocupa de alto, en píxeles de la plantilla. */
  altoPx: number;
  /** ¿Se sale de la caja? */
  desborda: boolean;
}

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

/**
 * Mide un texto como lo va a partir el PDF: por palabras y, si una palabra sola
 * no cabe, por caracteres. Se mide **en píxeles de la plantilla**, que es la
 * unidad del lienzo, y así el resultado se compara directamente con el alto de
 * la caja.
 */
export function medirTexto(
  texto: string,
  caja: Pick<CajaCertificado, 'ancho' | 'alto' | 'tamano' | 'negrita' | 'cursiva'>,
  lienzo: LienzoPlantilla,
): MedidaTexto {
  const tamanoPx = caja.tamano * pxPorPunto(lienzo);
  const ctx = contexto();
  const ancho = caja.ancho;

  if (!ctx || !texto.trim()) {
    const lineas = texto.trim() ? 1 : 0;
    return {
      lineas,
      altoPx: lineas * tamanoPx * INTERLINEADO,
      desborda: false,
    };
  }

  ctx.font = `${caja.cursiva ? 'italic ' : ''}${caja.negrita ? '700' : '400'} ${tamanoPx}px Arial, Helvetica, sans-serif`;
  const mide = (t: string) => ctx.measureText(t).width;

  let lineas = 0;
  for (const parrafo of texto.split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
      lineas += 1;
      continue;
    }
    lineas += envolver(palabras, mide, ancho);
  }

  const altoPx = lineas * tamanoPx * INTERLINEADO;
  // Medio píxel de tolerancia: por debajo de eso es redondeo, no un desborde.
  return { lineas, altoPx, desborda: altoPx > caja.alto + 0.5 };
}

/** Cuenta las líneas que ocupan unas palabras en un ancho dado. */
function envolver(
  palabras: string[],
  mide: (texto: string) => number,
  ancho: number,
): number {
  let lineas = 1;
  let actual = '';

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (mide(prueba) <= ancho) {
      actual = prueba;
      continue;
    }
    if (actual) {
      lineas += 1;
      actual = '';
    }
    // La palabra sola tampoco cabe: el PDF la parte, así que aquí también.
    let trozo = '';
    for (const caracter of palabra) {
      if (trozo && mide(trozo + caracter) > ancho) {
        lineas += 1;
        trozo = caracter;
      } else {
        trozo += caracter;
      }
    }
    actual = trozo;
  }
  return lineas;
}

/**
 * Lo que necesita la firma: la raya, el nombre y el cargo. El nombre va a
 * `tamano` y el cargo a 0.6 de ese tamaño, con los mismos huecos que dibuja el
 * PDF (`certificado-pdf.service.ts`).
 */
export function altoNecesarioFirma(
  tamano: number,
  lienzo: LienzoPlantilla,
): number {
  return Math.round((10 + tamano + Math.max(8, tamano * 0.6)) * pxPorPunto(lienzo));
}

/** Todo lo que hace falta para revisar una plantilla. */
export interface RevisionPlantilla {
  campos: CamposCertificado;
  textosLegales: BloqueLegal[];
  lienzo: LienzoPlantilla;
  firmaNombre: string;
  /** Proporción (ancho/alto) de la imagen de fondo, si se pudo leer. */
  proporcionFondo: number | null;
  hayFondo: boolean;
  /** Etiquetas del catálogo, para nombrar cada dato en los mensajes. */
  etiquetas: { clave: ClaveCampoCertificado; etiqueta: string }[];
}

/**
 * La revisión completa: los problemas **graves** (que bloquean activar) y los
 * avisos. Se calcula con los textos de ejemplo de cada caja, que son los que el
 * presidente tiene a la vista: si el ejemplo no cabe, se bloquea; y si el
 * nombre real de un alumno es más largo, el aviso sale al emitir.
 */
export function revisarPlantilla(revision: RevisionPlantilla): ProblemaPlantilla[] {
  const { campos, textosLegales, lienzo, firmaNombre, proporcionFondo, hayFondo, etiquetas } =
    revision;
  const problemas: ProblemaPlantilla[] = [];

  for (const { clave, etiqueta } of etiquetas) {
    const campo = campos[clave];
    if (!campo) continue;

    if (clave === 'firma') {
      // La firma no imprime la muestra: imprime el nombre real de quien firma
      // más el cargo. Se mide eso, que es lo que va a salir.
      const necesario = altoNecesarioFirma(campo.tamano, lienzo);
      revisarCaja(problemas, campo, etiqueta, lienzo, Math.min(campo.alto, necesario));
      if (necesario > campo.alto + 0.5) {
        problemas.push({
          gravedad: 'grave',
          donde: etiqueta,
          mensaje: `La caja es más baja que la firma (necesita unos ${necesario} px de alto y tiene ${campo.alto}): agrándala o baja el tamaño de letra.`,
        });
      }
      if (firmaNombre.trim()) {
        const medida = medirTexto(firmaNombre, campo, lienzo);
        if (medida.desborda) {
          problemas.push({
            gravedad: 'grave',
            donde: etiqueta,
            mensaje: `El nombre de la firma no cabe en su caja (${medida.lineas} línea(s)): agrándala o baja el tamaño de letra.`,
          });
        }
      }
      continue;
    }

    const muestra = campo.muestra;
    const medida = muestra?.trim() ? medirTexto(muestra, campo, lienzo) : null;
    revisarCaja(problemas, campo, etiqueta, lienzo, medida?.altoPx);
    if (medida?.desborda) {
      problemas.push({
        gravedad: 'grave',
        donde: etiqueta,
        mensaje: `El texto de ejemplo no cabe en su caja (ocupa ${medida.lineas} línea(s)): agranda la caja o baja el tamaño de letra.`,
      });
    }
  }

  for (const bloque of textosLegales) {
    const nombre = `Párrafo legal ${bloque.id}`;
    const medida = bloque.texto.trim()
      ? medirTexto(bloque.texto, bloque, lienzo)
      : null;
    revisarCaja(problemas, bloque, nombre, lienzo, medida?.altoPx);
    if (medida?.desborda) {
      problemas.push({
        gravedad: 'grave',
        donde: nombre,
        mensaje: `El texto no cabe en su caja (ocupa ${medida.lineas} línea(s)): agranda la caja o baja el tamaño de letra.`,
      });
    }
  }

  if (!hayFondo) {
    problemas.push({
      gravedad: 'aviso',
      donde: 'Fondo',
      mensaje:
        'La plantilla no tiene imagen de fondo: el certificado saldrá con los datos sobre un fondo liso.',
    });
  } else if (proporcionFondo !== null) {
    const esperada = lienzo.anchoPx / lienzo.altoPx;
    if (Math.abs(proporcionFondo - esperada) / esperada > 0.01) {
      problemas.push({
        gravedad: 'aviso',
        donde: 'Fondo',
        mensaje:
          'La imagen de fondo no tiene la proporción del certificado: se recorta por el centro para tapar la hoja sin deformarla. Lo ideal es subirla en A4 horizontal.',
      });
    }
  }

  return problemas;
}

/** Las dos comprobaciones que valen para cualquier caja. */
function revisarCaja(
  problemas: ProblemaPlantilla[],
  caja: { x: number; y: number; ancho: number; alto: number },
  donde: string,
  lienzo: LienzoPlantilla,
  /** Lo que ocupa el texto de verdad, si se pudo medir. */
  altoTexto?: number,
): void {
  if (!dentroDelLienzo(caja, lienzo)) {
    problemas.push({
      gravedad: 'grave',
      donde,
      mensaje:
        'Se sale del certificado. Muévelo hacia dentro: nada puede quedar fuera del papel.',
    });
    return;
  }
  // El margen se mide con la **tinta**, no con la caja: una caja alta con una
  // sola línea de texto puede llegar abajo sin que nada quede pegado al canto.
  const tinta = {
    x: caja.x,
    y: caja.y,
    ancho: caja.ancho,
    alto: Math.min(caja.alto, altoTexto ?? caja.alto),
  };
  if (tocaMargenSeguro(tinta, lienzo)) {
    problemas.push({
      gravedad: 'aviso',
      donde,
      mensaje:
        'Está dentro del margen seguro (el 5 % del borde): al imprimir puede quedar demasiado cerca del canto.',
    });
  }
}
