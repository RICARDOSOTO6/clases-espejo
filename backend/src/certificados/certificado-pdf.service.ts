import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  ALTO_PT,
  ANCHO_PT,
  CampoCertificado,
  CamposCertificado,
  CLAVES_CAMPO,
  INTERLINEADO,
  PASO_AJUSTE,
  TAMANO_MINIMO,
  TAMANO_MINIMO_NOMBRE,
} from './campos-certificado';
import { FONDOS_CERTIFICADO_DIR, direccionVerificacion } from './rutas-certificado';

/**
 * Genera el PDF de un certificado: el diseño (la imagen que subió la
 * presidencia) y, encima, los **tres datos** que cambian en cada certificado.
 *
 * Cuatro cosas que se hacen a propósito y conviene no «arreglar»:
 *
 * 1. **No se filtra ningún carácter.** El resumen de la clase usa una función
 *    `seguro()` que quita lo que la fuente estándar (WinAnsi) no sabe dibujar;
 *    aplicada aquí, un nombre con una letra rara saldría mutilado y nadie se
 *    enteraría. Por eso se intenta registrar una fuente Unicode del sistema y
 *    solo si no hay ninguna se sigue con la estándar, avisando en el registro.
 * 2. **El PDF se guarda tal como se emitió.** Este servicio no vuelve a mirar
 *    la plantilla después: quien lo llama archiva el resultado.
 * 3. **El diseño se recorta, no se deforma.** Si la imagen no tiene la
 *    proporción del A4 se escala hasta tapar la hoja y se recorta lo que sobra
 *    por el centro. Estirarla dejaría el certificado aplastado, y la vista
 *    previa del panel enseña exactamente el mismo recorte.
 * 4. **El nombre se ajusta solo.** Se mide el nombre real del alumno con la
 *    tipografía elegida y se baja el tamaño hasta que quepa; si con el mínimo
 *    legible no cabe en una línea, se parte en dos por los espacios y, si aun
 *    así no cabe, sale un aviso al emitir **con el nombre concreto**. Nunca se
 *    pierden letras: el nombre jamás se recorta.
 */

/**
 * Fuentes Unicode habituales, en el orden en que se prueban. La primera que
 * exista es la que se usa; si no hay ninguna, se cae a Helvetica y se avisa.
 * Se listan las de Windows y las de Linux porque el servidor de producción no
 * es la máquina donde se programa.
 *
 * La cursiva se toma del mismo juego de la fuente elegida: si el sistema no
 * trae el archivo en cursiva, se escribe recto (mejor eso que cambiar de
 * tipografía a mitad del certificado).
 */
const FUENTES_UNICODE: {
  normal: string;
  negrita?: string;
  cursiva?: string;
  negritaCursiva?: string;
}[] = [
  {
    normal: 'C:\\Windows\\Fonts\\arial.ttf',
    negrita: 'C:\\Windows\\Fonts\\arialbd.ttf',
    cursiva: 'C:\\Windows\\Fonts\\ariali.ttf',
    negritaCursiva: 'C:\\Windows\\Fonts\\arialbi.ttf',
  },
  {
    normal: 'C:\\Windows\\Fonts\\segoeui.ttf',
    negrita: 'C:\\Windows\\Fonts\\segoeuib.ttf',
    cursiva: 'C:\\Windows\\Fonts\\segoeuii.ttf',
    negritaCursiva: 'C:\\Windows\\Fonts\\segoeuiz.ttf',
  },
  {
    normal: 'C:\\Windows\\Fonts\\calibri.ttf',
    negrita: 'C:\\Windows\\Fonts\\calibrib.ttf',
    cursiva: 'C:\\Windows\\Fonts\\calibrii.ttf',
    negritaCursiva: 'C:\\Windows\\Fonts\\calibriz.ttf',
  },
  {
    normal: 'C:\\Windows\\Fonts\\verdana.ttf',
    negrita: 'C:\\Windows\\Fonts\\verdanab.ttf',
    cursiva: 'C:\\Windows\\Fonts\\verdanai.ttf',
    negritaCursiva: 'C:\\Windows\\Fonts\\verdanaz.ttf',
  },
  {
    normal: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    negrita: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    cursiva: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
    negritaCursiva: '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
  },
  {
    normal: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    negrita: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    cursiva: '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
    negritaCursiva:
      '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf',
  },
  {
    normal: '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    negrita: '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    cursiva: '/usr/share/fonts/dejavu/DejaVuSans-Oblique.ttf',
    negritaCursiva: '/usr/share/fonts/dejavu/DejaVuSans-BoldOblique.ttf',
  },
];

/**
 * Zona de silencio del QR, en módulos. El estándar pide 4 y sin ella muchos
 * lectores no enganchan el código: es lo que hace que un QR de 3 cm se pueda
 * escanear desde un teléfono a una distancia normal.
 */
const MARGEN_QR_MODULOS = 4;

/** El dato del alumno y de la clase que se imprime en el certificado. */
export interface DatosCertificado {
  folio: string;
  alumno: { nombre: string; matricula: string };
  plantilla: {
    version: number;
    anchoPx: number;
    altoPx: number;
    fondoUrl: string | null;
    campos: CamposCertificado;
  };
}

/** El PDF ya armado, con lo que hubo que avisar por el camino. */
export interface PdfGenerado {
  buffer: Buffer;
  avisos: string[];
}

/** Cómo queda el nombre después del autoajuste, para poder avisar. */
export interface NombreAjustado {
  lineas: string[];
  tamano: number;
  /** `true` cuando ni con el mínimo y dos líneas cabe en el hueco. */
  desborda: boolean;
}

/** Se avisa una sola vez de que no hay fuente Unicode, no en cada certificado. */
let avisadoSinFuente = false;
let avisadoSinFondo = false;

/**
 * La etiqueta con la que se nombra un dato en los avisos. Está aquí y no en el
 * catálogo porque un aviso se lee en la pantalla de emisión, donde el catálogo
 * del panel no hace falta.
 */
const ETIQUETAS: Record<string, string> = {
  nombre: 'nombre del alumno',
  folio: 'folio',
  qr: 'código QR',
};

@Injectable()
export class CertificadoPdfService {
  private readonly logger = new Logger(CertificadoPdfService.name);

  async generar(datos: DatosCertificado): Promise<PdfGenerado> {
    const avisos: string[] = [];
    const doc = new PDFDocument({
      size: [ANCHO_PT, ALTO_PT],
      margin: 0,
      // El certificado es una hoja sola: sin esto, un texto que se pase de
      // largo añadiría una segunda página en blanco al PDF.
      autoFirstPage: true,
      bufferPages: false,
    });

    const trozos: Buffer[] = [];
    doc.on('data', (c: Buffer) => trozos.push(c));
    const terminado = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(trozos)));
      doc.on('error', reject);
    });

    this.registrarFuentes(doc);

    // --- El diseño (la imagen que subió la presidencia) ---
    const fondo = this.leerFondo(datos.plantilla.fondoUrl, avisos);
    if (fondo) {
      this.dibujarFondo(doc, fondo, avisos);
    }

    // --- Los tres datos que cambian ---
    const escalaX = ANCHO_PT / datos.plantilla.anchoPx;
    const escalaY = ALTO_PT / datos.plantilla.altoPx;

    for (const clave of CLAVES_CAMPO) {
      const campo = datos.plantilla.campos[clave];
      if (!campo) continue;
      const caja = this.aPuntos(campo, escalaX, escalaY);

      if (clave === 'nombre') {
        this.escribirNombre(doc, caja, datos.alumno.nombre, campo, avisos);
        continue;
      }
      if (clave === 'folio') {
        this.escribirFolio(doc, caja, datos.folio, campo, avisos);
        continue;
      }
      await this.dibujarQr(doc, caja, datos.folio, avisos);
    }

    doc.end();
    return { buffer: await terminado, avisos };
  }

  /**
   * El QR de un folio, en PNG, para que el panel pueda enseñar en la vista
   * previa exactamente el mismo código que va a salir impreso. El PDF no usa
   * este método: incrusta el PNG directamente.
   */
  async qrDeFolio(folio: string, ancho = 600): Promise<Buffer> {
    return this.generarQr(folio, ancho);
  }

  // --- Los tres datos ---

  /**
   * El **nombre del alumno**, con autoajuste.
   *
   * El recuerdo que hace que el nombre nunca se salga de su hueco:
   *
   * 1. Se mide el nombre con la tipografía y el tamaño de partida. Si cabe en
   *    una línea (de ancho **y** de alto), se escribe así.
   * 2. Si no, se baja el tamaño en pasos de medio punto hasta el **mínimo
   *    legible** ([`TAMANO_MINIMO_NOMBRE`], 18 pt) buscando la línea más
   *    grande que sí quepa.
   * 3. Si con el mínimo no cabe en una línea, se parte en **dos líneas por los
   *    espacios** (nunca cortando una palabra) y se comprueba que las dos caben.
   * 4. Si aun así no cabe, se avisa **diciendo el nombre** y se escribe al
   *    mínimo: el nombre se lee, aunque se salga del hueco por abajo. Preferimos
   *    eso a mutilar el nombre de una persona.
   *
   * El texto se escribe centrado verticalmente en su hueco, que es como está
   * pensada la caja de 3 cm de la guía (ahí caben dos líneas).
   */
  private escribirNombre(
    doc: any,
    caja: { x: number; y: number; ancho: number; alto: number },
    nombre: string,
    campo: CampoCertificado,
    avisos: string[],
  ): void {
    const texto = (nombre ?? '').trim();
    if (!texto) return;

    doc.font(this.fuente(doc, campo.negrita, campo.cursiva));
    const minimo = this.minimoDe(campo);
    const ajuste = this.ajustarNombre(doc, caja, texto, campo.tamano, minimo);

    this.escribirLineas(doc, caja, ajuste.lineas, ajuste.tamano, campo);

    if (ajuste.desborda) {
      const aviso = `El nombre «${texto}» no cabe en el hueco del nombre ni con el tamaño mínimo (${minimo} pt) repartido en dos líneas: en el certificado el nombre sale fuera de su hueco. Agranda el hueco del nombre en la plantilla.`;
      if (!avisos.includes(aviso)) avisos.push(aviso);
      this.logger.warn(aviso);
    }
  }

  /**
   * El **folio**, en su hueco. No se ajusta: es un código corto de longitud
   * fija, así que o cabe o el hueco está mal medido; en ese caso se avisa en vez
   * de encogerlo, porque un folio más pequeño que el resto del certificado se
   * lee mal justo donde hay que leerlo.
   */
  private escribirFolio(
    doc: any,
    caja: { x: number; y: number; ancho: number; alto: number },
    folio: string,
    campo: CampoCertificado,
    avisos: string[],
  ): void {
    const texto = (folio ?? '').trim();
    if (!texto) return;

    doc
      .font(this.fuente(doc, campo.negrita, campo.cursiva))
      .fontSize(campo.tamano);
    if (doc.widthOfString(texto) > caja.ancho + 0.5) {
      const aviso = `El folio «${texto}» no cabe en su hueco: en el certificado sale desbordado. Agranda el hueco del folio o baja el tamaño de letra en la plantilla.`;
      if (!avisos.includes(aviso)) avisos.push(aviso);
    }

    this.escribirLineas(doc, caja, [texto], campo.tamano, campo);
  }

  /**
   * El **QR** que apunta a la dirección pública de verificación
   * (`{URL_PUBLICA}/verificar/{folio}`).
   *
   * Va siempre en **negro sobre blanco** y con su zona de silencio: sobre un
   * fondo de color o sin margen, un teléfono no lo lee. Para que eso se cumpla
   * aunque el diseño tenga algo detrás del hueco, se pinta primero un
   * rectángulo blanco del tamaño del hueco.
   */
  private async dibujarQr(
    doc: any,
    caja: { x: number; y: number; ancho: number; alto: number },
    folio: string,
    avisos: string[],
  ): Promise<void> {
    try {
      // El QR es cuadrado por definición: se inscribe en el hueco (por el lado
      // más corto) y se centra. El fondo blanco sí cubre todo el hueco, porque
      // la zona de silencio es lo que hace que se lea. Así, un hueco medido a
      // ojo con otra proporción no saca un QR deformado que ningún teléfono
      // leería.
      const lado = Math.min(caja.ancho, caja.alto);
      const png = await this.generarQr(folio, Math.max(300, Math.round(lado * 2)));
      doc.save();
      doc.rect(caja.x, caja.y, caja.ancho, caja.alto).fill('#ffffff');
      doc.image(png, caja.x + (caja.ancho - lado) / 2, caja.y + (caja.alto - lado) / 2, {
        width: lado,
        height: lado,
      });
      doc.restore();
    } catch (error) {
      const aviso =
        'No se pudo generar el código QR del certificado: el hueco del QR salió vacío.';
      if (!avisos.includes(aviso)) avisos.push(aviso);
      this.logger.warn(`${aviso} ${(error as Error)?.message ?? ''}`);
    }
  }

  /** El PNG del QR de un folio, apuntando a la verificación pública. */
  private async generarQr(folio: string, ancho: number): Promise<Buffer> {
    return QRCode.toBuffer(direccionVerificacion(folio), {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: MARGEN_QR_MODULOS,
      width: Math.min(2000, Math.max(200, Math.round(ancho))),
      color: { dark: '#000000ff', light: '#ffffffff' },
    });
  }

  // --- El nombre, paso a paso ---

  /**
   * Encuentra cómo escribir el nombre dentro de su hueco: una línea con el
   * tamaño más grande que quepa, o dos líneas al mínimo legible. El resultado
   * incluye si hubo que rendirse, para poder avisar al emitir.
   *
   * Se mide con el **mismo** documento (misma fuente y mismo tamaño) con el que
   * después se escribe: cualquier otra medida mentiría.
   */
  ajustarNombre(
    doc: any,
    caja: { ancho: number; alto: number },
    texto: string,
    tamanoDePartida: number,
    minimo: number,
  ): NombreAjustado {
    const suelo = Math.max(1, Math.min(minimo, tamanoDePartida));

    const cabeUnaLinea = (tamano: number) => {
      doc.fontSize(tamano);
      return (
        doc.widthOfString(texto) <= caja.ancho + 0.5 &&
        tamano * INTERLINEADO <= caja.alto + 0.5
      );
    };

    // 1) Una línea, del tamaño de partida hacia abajo.
    const inicio = Math.max(suelo, Math.round(tamanoDePartida / PASO_AJUSTE) * PASO_AJUSTE);
    for (let tamano = inicio; tamano >= suelo; tamano -= PASO_AJUSTE) {
      if (cabeUnaLinea(tamano)) {
        return { lineas: [texto], tamano: redondear(tamano), desborda: false };
      }
    }

    // 2) Dos líneas al mínimo legible, partidas por los espacios.
    const partes = this.partirEnDos(texto);
    if (partes) {
      doc.fontSize(suelo);
      const caben = partes.every((parte) => doc.widthOfString(parte) <= caja.ancho + 0.5);
      const dosLineas = suelo * INTERLINEADO * 2 <= caja.alto + 0.5;
      if (caben && dosLineas) {
        return { lineas: partes, tamano: redondear(suelo), desborda: false };
      }
    }

    // 3) Ni así: se escribe al mínimo (nunca se pierden letras) y se avisa.
    return { lineas: [texto], tamano: redondear(suelo), desborda: true };
  }

  /**
   * El suelo del autoajuste de un hueco: el suyo, sin bajar del mínimo absoluto
   * ni pasar del tamaño de partida.
   */
  private minimoDe(campo: CampoCertificado): number {
    const propio = Number.isFinite(campo.tamanoMinimo)
      ? campo.tamanoMinimo
      : TAMANO_MINIMO_NOMBRE;
    return Math.max(TAMANO_MINIMO, Math.min(propio, campo.tamano));
  }

  /**
   * Parte el nombre en dos líneas **por los espacios**, buscando el corte que
   * deja las dos mitades más parecidas. Devuelve `null` si no hay ningún hueco
   * donde cortar (un nombre de una sola palabra): entonces no se parte, porque
   * partir una palabra por la mitad es mutilar el nombre de una persona.
   */
  private partirEnDos(texto: string): [string, string] | null {
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

  /**
   * Escribe una o dos líneas centradas **verticalmente** en su hueco, para que
   * el nombre quede donde lo espera el diseño. Se pasan las líneas ya decididas
   * (separadas por `\n`), así que pdfkit no vuelve a partir nada por su cuenta.
   */
  private escribirLineas(
    doc: any,
    caja: { x: number; y: number; ancho: number; alto: number },
    lineas: string[],
    tamano: number,
    estilo: { alineacion: string; color: string; negrita: boolean; cursiva?: boolean },
  ): void {
    doc
      .font(this.fuente(doc, estilo.negrita, estilo.cursiva ?? false))
      .fontSize(tamano)
      .fillColor(estilo.color);

    const altoTexto = tamano * INTERLINEADO * lineas.length;
    const y = caja.y + Math.max(0, (caja.alto - altoTexto) / 2);
    doc.text(lineas.join('\n'), caja.x, y, {
      width: caja.ancho,
      align: estilo.alineacion,
      lineGap: 0,
    });
  }

  // --- El diseño de fondo ---

  /**
   * El diseño, escalado hasta tapar la hoja y recortado por el centro.
   *
   * Se recorta con un `clip` explícito y no confiando en que el visor corte
   * solo: así el PDF no lleva dibujada una imagen más grande que la hoja (que
   * algunos visores enseñan fuera del papel al imprimir sin márgenes).
   */
  private dibujarFondo(doc: any, fondo: Buffer, avisos: string[]): void {
    try {
      const imagen = doc.openImage(fondo);
      const escala = Math.max(ANCHO_PT / imagen.width, ALTO_PT / imagen.height);
      const ancho = imagen.width * escala;
      const alto = imagen.height * escala;
      const proporcionHoja = ANCHO_PT / ALTO_PT;
      const proporcionImagen = imagen.width / imagen.height;

      // Un 1 % de diferencia ya se nota en un certificado impreso; por debajo
      // de eso es redondeo y no vale la pena preocupar a nadie.
      if (Math.abs(proporcionImagen - proporcionHoja) / proporcionHoja > 0.01) {
        avisos.push(
          'El diseño de la plantilla no tiene la proporción del certificado (A4 horizontal): se recortó por el centro para tapar la hoja sin deformarlo. Conviene subirlo con la proporción correcta.',
        );
      }

      doc.save();
      doc.rect(0, 0, ANCHO_PT, ALTO_PT).clip();
      doc.image(fondo, (ANCHO_PT - ancho) / 2, (ALTO_PT - alto) / 2, {
        width: ancho,
        height: alto,
      });
      doc.restore();
    } catch {
      avisos.push(
        'El diseño de la plantilla no se pudo incrustar en el PDF (formatos admitidos para el PDF: PNG y JPG). El certificado salió sin diseño de fondo.',
      );
      this.avisarSinFondo();
    }
  }

  /** De píxeles de la plantilla a puntos del PDF. */
  private aPuntos(
    campo: Pick<CampoCertificado, 'x' | 'y' | 'ancho' | 'alto' | 'tamano'> & {
      color?: string;
    },
    escalaX: number,
    escalaY: number,
  ) {
    return {
      x: campo.x * escalaX,
      y: campo.y * escalaY,
      ancho: campo.ancho * escalaX,
      alto: campo.alto * escalaY,
      tamano: campo.tamano,
      color: campo.color ?? '#000000',
    };
  }

  /** Lee la imagen del diseño del disco, si la plantilla tiene una. */
  private leerFondo(fondoUrl: string | null, avisos: string[]): Buffer | null {
    if (!fondoUrl) return null;
    const ruta = join(FONDOS_CERTIFICADO_DIR, basename(fondoUrl));
    if (!existsSync(ruta)) {
      this.logger.warn(`No se encontró el diseño de la plantilla: ${ruta}`);
      avisos.push(
        'No se encontró el archivo del diseño de la plantilla: el certificado salió sin diseño de fondo.',
      );
      return null;
    }
    try {
      return readFileSync(ruta);
    } catch {
      avisos.push('No se pudo leer el diseño de la plantilla.');
      return null;
    }
  }

  /**
   * Registra la fuente Unicode en **este** documento (pdfkit registra por
   * documento, no de forma global). Si no hay ninguna disponible se sigue con
   * Helvetica, que es lo que ya usaba el resumen, y se avisa en el registro.
   */
  private registrarFuentes(doc: any): void {
    const encontrada = this.buscarFuente();
    if (!encontrada) {
      this.avisarSinFuente();
      return;
    }
    doc.registerFont('Certificado', encontrada.normal);
    if (encontrada.negrita) {
      doc.registerFont('CertificadoNegrita', encontrada.negrita);
    }
    if (encontrada.cursiva) {
      doc.registerFont('CertificadoCursiva', encontrada.cursiva);
    }
    if (encontrada.negritaCursiva) {
      doc.registerFont('CertificadoNegritaCursiva', encontrada.negritaCursiva);
    }
  }

  /** La fuente que toca según el estilo pedido, con su mejor reemplazo. */
  private fuente(doc: any, negrita: boolean, cursiva: boolean): string {
    const encontrada = this.buscarFuente();
    if (!encontrada) {
      if (negrita && cursiva) return 'Helvetica-BoldOblique';
      if (negrita) return 'Helvetica-Bold';
      return cursiva ? 'Helvetica-Oblique' : 'Helvetica';
    }
    if (negrita && cursiva && encontrada.negritaCursiva) {
      return 'CertificadoNegritaCursiva';
    }
    if (negrita && encontrada.negrita) return 'CertificadoNegrita';
    if (cursiva && encontrada.cursiva) return 'CertificadoCursiva';
    return 'Certificado';
  }

  /** La primera fuente Unicode que exista en el sistema (o `null`). */
  private buscarFuente(): {
    normal: string;
    negrita?: string;
    cursiva?: string;
    negritaCursiva?: string;
  } | null {
    for (const fuente of FUENTES_UNICODE) {
      if (existsSync(fuente.normal)) {
        const opcional = (ruta?: string) =>
          ruta && existsSync(ruta) ? ruta : undefined;
        return {
          normal: fuente.normal,
          negrita: opcional(fuente.negrita),
          cursiva: opcional(fuente.cursiva),
          negritaCursiva: opcional(fuente.negritaCursiva),
        };
      }
    }
    return null;
  }

  private avisarSinFuente(): void {
    if (avisadoSinFuente) return;
    avisadoSinFuente = true;
    this.logger.warn(
      'No se encontró ninguna fuente Unicode para los certificados (se probaron ' +
        FUENTES_UNICODE.map((f) => f.normal).join(', ') +
        '). Se sigue con la fuente estándar del PDF: los nombres con caracteres fuera de WinAnsi podrían no dibujarse bien.',
    );
  }

  private avisarSinFondo(): void {
    if (avisadoSinFondo) return;
    avisadoSinFondo = true;
    this.logger.warn(
      'El diseño de la plantilla no se pudo incrustar en el PDF. PDFKit solo admite PNG y JPG: si la imagen es WEBP, hay que volver a subirla en PNG o JPG.',
    );
  }
}

/** Un tamaño con medio punto de precisión, sin colas de coma flotante. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
