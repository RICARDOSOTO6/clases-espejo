import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import PDFDocument from 'pdfkit';
import {
  ALTO_PT,
  ANCHO_PT,
  CampoCertificado,
  CamposCertificado,
  CATALOGO_CAMPOS,
  CLAVES_CAMPO,
  ClaveCampo,
  TextosLegales,
} from './campos-certificado';
import { FONDOS_CERTIFICADO_DIR } from './rutas-certificado';

/**
 * Genera el PDF de un certificado: el fondo de la plantilla y, encima, los
 * datos del alumno y de la clase espejo.
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
 * 3. **El fondo se recorta, no se deforma.** Si la imagen no tiene la
 *    proporción del A4 (pasa: la de la CACE mide 749 × 566), se escala hasta
 *    tapar la hoja y se recorta lo que sobra por el centro. Estirarla dejaría
 *    el certificado aplastado, y el editor enseña exactamente el mismo recorte
 *    (`background-size: cover`), así que lo que se ve es lo que sale.
 * 4. **Las medidas salen de un solo sitio** (`campos-certificado.ts`): el A4 en
 *    puntos y su conversión a píxeles de plantilla. El editor visual cuenta con
 *    los mismos números, y por eso la vista previa y el PDF coinciden.
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

/** El dato del alumno y de la clase que se imprime en el certificado. */
export interface DatosCertificado {
  folio: string;
  alumno: { nombre: string; matricula: string };
  clase: {
    titulo: string;
    plataforma: string;
    fechaInicio: Date | string | null;
    fechaFin: Date | string | null;
  };
  instituciones: {
    origen: { nombre: string; pais: string };
    destino: { nombre: string; pais: string };
  };
  docentes: { nombre: string; institucion: string; pais: string; rol: string }[];
  plantilla: {
    version: number;
    anchoPx: number;
    altoPx: number;
    fondoUrl: string | null;
    campos: CamposCertificado;
    textosLegales: TextosLegales;
    firmaNombre: string;
  };
}

/** El PDF ya armado, con lo que hubo que avisar por el camino. */
export interface PdfGenerado {
  buffer: Buffer;
  avisos: string[];
}

/** Se avisa una sola vez de que no hay fuente Unicode, no en cada certificado. */
let avisadoSinFuente = false;
let avisadoSinFondo = false;

/** La clave del dato que lleva la raya de firma. */
const CLAVE_FIRMA: ClaveCampo = 'firma';

function fecha(d: Date | string | null | undefined): string {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  return x.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** La etiqueta con la que se nombra un dato en los avisos. */
function etiquetaDe(clave: string): string {
  return (
    CATALOGO_CAMPOS.find((c) => c.clave === clave)?.etiqueta ?? clave
  );
}

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

    // --- Fondo ---
    const fondo = this.leerFondo(datos.plantilla.fondoUrl, avisos);
    if (fondo) {
      this.dibujarFondo(doc, fondo, avisos);
    }

    // --- Datos del certificado ---
    const escalaX = ANCHO_PT / datos.plantilla.anchoPx;
    const escalaY = ALTO_PT / datos.plantilla.altoPx;
    const textos = this.textosDeLosDatos(datos);

    this.avisarDesbordes(doc, datos, textos, escalaX, escalaY, avisos);

    for (const clave of CLAVES_CAMPO) {
      const campo = datos.plantilla.campos[clave];
      const texto = textos[clave];
      if (!campo || !texto) continue;
      const caja = this.aPuntos(campo, escalaX, escalaY);
      if (clave === CLAVE_FIRMA) {
        this.dibujarFirma(doc, caja, texto, campo.cursiva);
      } else {
        this.escribir(doc, caja, texto, campo);
      }
    }

    // --- Textos legales ---
    for (const bloque of datos.plantilla.textosLegales) {
      if (!bloque.texto?.trim()) continue;
      const caja = this.aPuntos(bloque, escalaX, escalaY);
      this.escribir(doc, caja, bloque.texto, bloque);
    }

    doc.end();
    return { buffer: await terminado, avisos };
  }

  /**
   * El fondo, escalado hasta tapar la hoja y recortado por el centro.
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
          'El fondo de la plantilla no tiene la proporción del certificado (A4 horizontal): se recortó por el centro para tapar la hoja sin deformarlo. Conviene subirlo con la proporción correcta.',
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
        'El fondo de la plantilla no se pudo incrustar en el PDF (formatos admitidos para el PDF: PNG y JPG). El certificado salió sin fondo.',
      );
      this.avisarSinFondo();
    }
  }

  /**
   * Avisa de los datos cuyo texto no cabe en su caja, midiendo con la **misma**
   * fuente y el mismo ancho con los que se va a escribir.
   *
   * El editor ya bloquea guardar una plantilla con este problema, pero la
   * plantilla se diseña con textos de ejemplo y el nombre que llega al emitir
   * es el de verdad: este aviso es el que cubre ese hueco, y sale en la
   * pantalla de emisión, que es donde se puede hacer algo.
   */
  private avisarDesbordes(
    doc: any,
    datos: DatosCertificado,
    textos: Record<string, string>,
    escalaX: number,
    escalaY: number,
    avisos: string[],
  ): void {
    const revisar = (
      caja: { ancho: number; alto: number; tamano: number; negrita: boolean; cursiva: boolean },
      texto: string,
      nombre: string,
    ) => {
      doc
        .font(this.fuente(doc, caja.negrita, caja.cursiva))
        .fontSize(caja.tamano);
      const altoTexto = doc.heightOfString(texto, {
        width: caja.ancho * escalaX,
      });
      if (altoTexto > caja.alto * escalaY + 0.5) {
        const aviso = `El texto de «${nombre}» no cabe en su caja: en el certificado sale desbordado. Agranda la caja o baja el tamaño de letra en la plantilla.`;
        if (!avisos.includes(aviso)) avisos.push(aviso);
      }
    };

    for (const clave of CLAVES_CAMPO) {
      const campo = datos.plantilla.campos[clave];
      const texto = textos[clave];
      if (campo && texto) revisar(campo, texto, etiquetaDe(clave));
    }
    for (const bloque of datos.plantilla.textosLegales) {
      if (bloque.texto?.trim()) {
        revisar(bloque, bloque.texto, `párrafo legal ${bloque.id}`);
      }
    }
  }

  /**
   * El nombre de quien firma, con su raya y el cargo. La raya se dibuja aunque
   * no haya nombre (la plantilla puede existir antes que el presidente), que es
   * justo lo que deja el diseño: la firma es un dato configurable.
   *
   * El cargo se coloca debajo del nombre, pero **sin salirse de la caja**: si
   * el presidente encoge la caja de la firma, lo que se recorta es el cargo, no
   * el nombre que da validez al documento.
   */
  private dibujarFirma(
    doc: any,
    caja: {
      x: number;
      y: number;
      ancho: number;
      alto: number;
      tamano: number;
      color: string;
    },
    texto: string,
    cursiva: boolean,
  ): void {
    doc
      .strokeColor('#333333')
      .lineWidth(0.8)
      .moveTo(caja.x, caja.y)
      .lineTo(caja.x + caja.ancho, caja.y)
      .stroke();

    doc
      .font(this.fuente(doc, true, cursiva))
      .fontSize(caja.tamano)
      .fillColor(caja.color)
      .text(texto, caja.x, caja.y + 6, {
        width: caja.ancho,
        align: 'center',
        lineBreak: false,
      });

    const altoCargo = Math.max(8, caja.tamano * 0.6);
    const yCargo = Math.min(
      caja.y + 10 + caja.tamano,
      caja.y + caja.alto - altoCargo,
    );
    doc
      .font(this.fuente(doc, false, false))
      .fontSize(altoCargo)
      .fillColor('#666666')
      .text('Presidente de la CACE', caja.x, Math.max(caja.y + 8, yCargo), {
        width: caja.ancho,
        align: 'center',
        lineBreak: false,
      });
  }

  private escribir(
    doc: any,
    caja: { x: number; y: number; ancho: number; tamano: number },
    texto: string,
    estilo: { alineacion: string; color: string; negrita: boolean; cursiva?: boolean },
  ): void {
    doc
      .font(this.fuente(doc, estilo.negrita, estilo.cursiva ?? false))
      .fontSize(caja.tamano)
      .fillColor(estilo.color)
      .text(texto, caja.x, caja.y, {
        width: caja.ancho,
        align: estilo.alineacion,
      });
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

  /** El texto que corresponde a cada dato del certificado. */
  private textosDeLosDatos(datos: DatosCertificado): Record<string, string> {
    const { clase, instituciones, docentes, alumno, folio } = datos;
    const desde = fecha(clase.fechaInicio);
    const hasta = fecha(clase.fechaFin);
    const periodo =
      desde && hasta
        ? `del ${desde} al ${hasta}`
        : desde
          ? `desde el ${desde}`
          : hasta
            ? `hasta el ${hasta}`
            : '';

    return {
      titulo: clase.titulo,
      nombre: alumno.nombre,
      instituciones: `${instituciones.origen.nombre} (${instituciones.origen.pais}) y ${instituciones.destino.nombre} (${instituciones.destino.pais})`,
      fechas: periodo,
      docentes:
        docentes.length > 0
          ? `Docentes: ${docentes
              .map((d) => `${d.nombre} (${d.institucion})`)
              .join('  ·  ')}`
          : '',
      firma: datos.plantilla.firmaNombre,
      folio: `Folio: ${folio}`,
    };
  }

  /** Lee la imagen de fondo del disco, si la plantilla tiene una. */
  private leerFondo(
    fondoUrl: string | null,
    avisos: string[],
  ): Buffer | null {
    if (!fondoUrl) return null;
    const ruta = join(FONDOS_CERTIFICADO_DIR, basename(fondoUrl));
    if (!existsSync(ruta)) {
      this.logger.warn(`No se encontró el fondo de la plantilla: ${ruta}`);
      avisos.push(
        'No se encontró el archivo del fondo de la plantilla: el certificado salió sin fondo.',
      );
      return null;
    }
    try {
      return readFileSync(ruta);
    } catch {
      avisos.push('No se pudo leer el fondo de la plantilla.');
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
      'El fondo de la plantilla no se pudo incrustar en el PDF. PDFKit solo admite PNG y JPG: si el fondo es WEBP, hay que volver a subirlo en PNG o JPG.',
    );
  }
}
