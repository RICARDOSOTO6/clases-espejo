import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import PDFDocument from 'pdfkit';
import {
  BloqueLegal,
  CampoCertificado,
  CamposCertificado,
  TextosLegales,
} from './campos-certificado';
import { FONDOS_CERTIFICADO_DIR } from './rutas-certificado';

/**
 * Genera el PDF de un certificado: el fondo de la plantilla y, encima, los
 * datos del alumno y de la clase espejo.
 *
 * Dos cosas que se hacen a propósito y conviene no «arreglar»:
 *
 * 1. **No se filtra ningún carácter.** El resumen de la clase usa una función
 *    `seguro()` que quita lo que la fuente estándar (WinAnsi) no sabe dibujar;
 *    aplicada aquí, un nombre con una letra rara saldría mutilado y nadie se
 *    enteraría. Por eso se intenta registrar una fuente Unicode del sistema y
 *    solo si no hay ninguna se sigue con la estándar, avisando en el registro.
 * 2. **El PDF se guarda tal como se emitió.** Este servicio no vuelve a mirar
 *    la plantilla después: quien lo llama archiva el resultado.
 */

/** A4 horizontal en puntos (1 pt = 1/72 pulgada): el tamaño de la hoja. */
const ANCHO_PT = 841.89;
const ALTO_PT = 595.28;

/**
 * Fuentes Unicode habituales, en el orden en que se prueban. La primera que
 * exista es la que se usa; si no hay ninguna, se cae a Helvetica y se avisa.
 * Se listan las de Windows y las de Linux porque el servidor de producción no
 * es la máquina donde se programa.
 */
const FUENTES_UNICODE: { normal: string; negrita?: string }[] = [
  { normal: 'C:\\Windows\\Fonts\\arial.ttf', negrita: 'C:\\Windows\\Fonts\\arialbd.ttf' },
  { normal: 'C:\\Windows\\Fonts\\segoeui.ttf', negrita: 'C:\\Windows\\Fonts\\segoeuib.ttf' },
  { normal: 'C:\\Windows\\Fonts\\calibri.ttf', negrita: 'C:\\Windows\\Fonts\\calibrib.ttf' },
  { normal: 'C:\\Windows\\Fonts\\verdana.ttf', negrita: 'C:\\Windows\\Fonts\\verdanab.ttf' },
  { normal: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', negrita: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' },
  { normal: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', negrita: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' },
  { normal: '/usr/share/fonts/dejavu/DejaVuSans.ttf', negrita: '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf' },
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
      try {
        doc.image(fondo, 0, 0, { width: ANCHO_PT, height: ALTO_PT });
      } catch {
        avisos.push(
          'El fondo de la plantilla no se pudo incrustar en el PDF (formatos admitidos para el PDF: PNG y JPG). El certificado salió sin fondo.',
        );
        this.avisarSinFondo();
      }
    }

    // --- Datos del certificado ---
    const escalaX = ANCHO_PT / datos.plantilla.anchoPx;
    const escalaY = ALTO_PT / datos.plantilla.altoPx;
    const textos = this.textosDeLosDatos(datos);

    for (const [clave, campo] of Object.entries(datos.plantilla.campos)) {
      const texto = textos[clave as keyof typeof textos];
      if (!texto) continue;
      const caja = this.aPuntos(campo, escalaX, escalaY);
      if (clave === 'firma') {
        this.dibujarFirma(doc, caja, texto);
      } else {
        this.escribir(doc, caja, texto, campo);
      }
    }

    // --- Textos legales ---
    for (const bloque of datos.plantilla.textosLegales) {
      if (!bloque.texto?.trim()) continue;
      const caja = this.aPuntos(bloque, escalaX, escalaY);
      this.escribir(
        doc,
        caja,
        bloque.texto,
        { ...bloque, negrita: false } as CampoCertificado,
      );
    }

    doc.end();
    return { buffer: await terminado, avisos };
  }

  /**
   * El nombre de quien firma, con su raya y el cargo. La raya se dibuja aunque
   * no haya nombre (la plantilla puede existir antes que el presidente), que es
   * justo lo que deja el diseño: la firma es un dato configurable.
   */
  private dibujarFirma(
    doc: any,
    caja: { x: number; y: number; ancho: number; tamano: number; color: string },
    texto: string,
  ): void {
    doc
      .strokeColor('#333333')
      .lineWidth(0.8)
      .moveTo(caja.x, caja.y)
      .lineTo(caja.x + caja.ancho, caja.y)
      .stroke();

    doc
      .font(this.fuente(doc, true))
      .fontSize(caja.tamano)
      .fillColor(caja.color)
      .text(texto, caja.x, caja.y + 6, {
        width: caja.ancho,
        align: 'center',
        lineBreak: false,
      });

    doc
      .font(this.fuente(doc, false))
      .fontSize(Math.max(8, caja.tamano * 0.6))
      .fillColor('#666666')
      .text('Presidente de la CACE', caja.x, caja.y + 10 + caja.tamano, {
        width: caja.ancho,
        align: 'center',
        lineBreak: false,
      });
  }

  private escribir(
    doc: any,
    caja: { x: number; y: number; ancho: number; tamano: number },
    texto: string,
    estilo: { alineacion: string; color: string; negrita: boolean },
  ): void {
    doc
      .font(this.fuente(doc, estilo.negrita))
      .fontSize(caja.tamano)
      .fillColor(estilo.color)
      .text(texto, caja.x, caja.y, {
        width: caja.ancho,
        align: estilo.alineacion,
      });
  }

  /** De píxeles de la plantilla a puntos del PDF. */
  private aPuntos(
    campo: Pick<CampoCertificado, 'x' | 'y' | 'ancho' | 'tamano'> & {
      color?: string;
    },
    escalaX: number,
    escalaY: number,
  ) {
    return {
      x: campo.x * escalaX,
      y: campo.y * escalaY,
      ancho: campo.ancho * escalaX,
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
  }

  private fuente(doc: any, negrita: boolean): string {
    const encontrada = this.buscarFuente();
    if (!encontrada) return negrita ? 'Helvetica-Bold' : 'Helvetica';
    if (negrita && encontrada.negrita) return 'CertificadoNegrita';
    return 'Certificado';
  }

  /** La primera fuente Unicode que exista en el sistema (o `null`). */
  private buscarFuente(): { normal: string; negrita?: string } | null {
    for (const fuente of FUENTES_UNICODE) {
      if (existsSync(fuente.normal)) {
        return {
          normal: fuente.normal,
          negrita:
            fuente.negrita && existsSync(fuente.negrita)
              ? fuente.negrita
              : undefined,
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
