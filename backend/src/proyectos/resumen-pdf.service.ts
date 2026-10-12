import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

/**
 * Genera el PDF "Resumen de clase espejo" para descargar e imprimir como
 * registro físico. Sirve para cualquier estado del proyecto: si la clase aún
 * está en planificación o en curso, se imprime lo que ya existe y se marca el
 * resto como pendiente.
 */

const AZUL = '#1F3A5F';
const GRIS = '#555555';

/** Deja solo caracteres que la fuente estándar del PDF (WinAnsi) puede dibujar. */
function seguro(texto: unknown): string {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/\u2192/g, '->') // flecha →
    .replace(/\u2713/g, '[x]') // ✓
    .replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u00A1\u00BF]/g, '');
}

function fecha(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '—';
  return x.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fechaHora(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '—';
  return x.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  EN_PLANIFICACION: 'En planificación',
  EN_CURSO: 'En curso',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  CONFIRMADO: 'Confirmado',
  CONFIRMADA: 'Confirmada',
  PENDIENTE: 'Pendiente',
  PROGRAMADA: 'Programada',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

function estado(v: string): string {
  return ETIQUETAS_ESTADO[v] ?? v ?? '—';
}

@Injectable()
export class ResumenPdfService {
  async generar(proyecto: any): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const trozos: Buffer[] = [];
    doc.on('data', (c: Buffer) => trozos.push(c));
    const terminado = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(trozos)));
      doc.on('error', reject);
    });

    const s = proyecto.solicitud;
    const origen = s?.asignacionOrigen;
    const instOrigen = origen?.docenteInstitucion?.institucion;
    const instDestino = s?.institucionDestino;

    // --- Encabezado ---
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(AZUL)
      .text('Resumen de Clase Espejo', { align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(GRIS)
      .text('Comunidad de Apoyo a Clases Espejo (CACE)', {
        align: 'center',
      });
    doc.moveDown(0.4);

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#000000')
      .text(seguro(s?.titulo), { align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(GRIS)
      .text(`Proyecto #${proyecto.id}  ·  ${estado(proyecto.estado)}`, {
        align: 'center',
      });
    doc.moveDown();

    // Línea divisoria
    this.linea(doc);

    // --- Instituciones ---
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(AZUL)
      .text('Instituciones participantes');
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#000000')
      .text(
        `${seguro(instOrigen?.nombre)} (${seguro(instOrigen?.pais)})  ->  ${seguro(instDestino?.nombre)} (${seguro(instDestino?.pais)})`,
      );
    doc.moveDown(0.6);

    // --- Docentes ---
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(AZUL)
      .text('Docentes participantes');
    for (const pd of proyecto.docentes ?? []) {
      const di = pd.asignacionDocente?.docenteInstitucion;
      const u = di?.docente?.usuario;
      const nombre = u
        ? `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`
        : '—';
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#000000')
        .text(
          `- ${seguro(nombre)}  (${seguro(di?.institucion?.pais)})  [${seguro(pd.rol)}]  · ${seguro(u?.correo)}`,
        );
    }
    doc.moveDown(0.6);

    // --- Datos generales ---
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(AZUL)
      .text('Datos de la clase');
    this.campo(doc, 'Estado', estado(proyecto.estado));
    this.campo(doc, 'Plataforma', seguro(proyecto.plataforma));
    this.campo(doc, 'Fecha de inicio', fecha(proyecto.fechaInicio));
    this.campo(doc, 'Fecha de fin', fecha(proyecto.fechaFin));
    this.campo(doc, 'Materia de origen', seguro(origen?.materia?.nombre));
    this.campo(doc, 'Materia de destino', seguro(s?.materiaDestino?.nombre));
    this.campo(doc, 'Objetivo', seguro(s?.objetivo));
    doc.moveDown(0.6);

    // --- Planificación ---
    const plan = proyecto.planificacion;
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(AZUL)
      .text('Planificación conjunta');
    if (plan) {
      this.campo(doc, 'Estado', estado(plan.estado));
      this.campo(doc, 'Objetivos acordados', seguro(plan.objetivosAcordados));
      this.campo(doc, 'Temas acordados', seguro(plan.temasAcordados));
      this.campo(doc, 'Metodología', seguro(plan.metodologia));
    } else {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(GRIS)
        .text('Sin planificación registrada todavía.');
    }
    doc.moveDown(0.6);

    // --- Sesiones y reportes ---
    const sesiones = proyecto.sesiones ?? [];
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(AZUL)
      .text(`Sesiones (${sesiones.length})`);
    if (sesiones.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(GRIS)
        .text('Aún no hay sesiones programadas.');
    } else {
      for (const ses of sesiones) {
        const rep = ses.reporte;
        const firmas = (rep?.participaciones ?? []).filter(
          (p: any) => p.confirmadoEn,
        ).length;
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#000000')
          .text(`· ${seguro(ses.titulo)}  [${estado(ses.estado)}]`);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(GRIS)
          .text(`    ${fechaHora(ses.fechaHora)}  ·  enlace: ${seguro(ses.enlaceVirtual)}`);
        if (rep) {
          this.campo(doc, 'Reporte', estado(rep.estado), '    ');
          this.campo(doc, 'Asistentes', String(rep.totalAsistentes ?? '—'), '    ');
          this.campo(doc, 'Incidencias', seguro(rep.incidencias), '    ');
          this.campo(
            doc,
            'Acuerdos para la siguiente sesión',
            seguro(rep.acuerdosSiguienteSesion),
            '    ',
          );
          this.campo(doc, 'Firmas', `${firmas}/${(rep?.participaciones ?? []).length}`, '    ');
        } else {
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(GRIS)
            .text('    Sin reporte de clase registrado.');
        }
      }
    }
    doc.moveDown(0.6);

    // --- Actividades ---
    const actividades = proyecto.actividades ?? [];
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(AZUL)
      .text(`Actividades (${actividades.length})`);
    for (const a of actividades) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#000000')
        .text(`· ${seguro(a.titulo)}  (límite: ${fecha(a.fechaLimite)})`);
      if (a.instrucciones) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(GRIS)
          .text(`    ${seguro(a.instrucciones)}`);
      }
    }
    if (actividades.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(GRIS)
        .text('Sin actividades registradas.');
    }
    doc.moveDown(0.6);

    // --- Evidencias ---
    const evidencias = proyecto.evidencias ?? [];
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(AZUL)
      .text(`Evidencias (${evidencias.length})`);
    for (const e of evidencias) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#000000')
        .text(`· ${seguro(e.tipo) || 'Evidencia'}  ·  ${seguro(e.archivoUrl)}`);
    }
    if (evidencias.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(GRIS)
        .text('Sin evidencias registradas.');
    }
    doc.moveDown(0.6);

    // --- Evaluación final ---
    const evaluaciones = proyecto.evaluaciones ?? [];
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(AZUL)
      .text(`Evaluación final (${evaluaciones.length})`);
    for (const e of evaluaciones) {
      this.campo(doc, 'Instrumento', seguro(e.instrumento));
      this.campo(doc, 'Resultado', seguro(e.resultado));
      this.campo(doc, 'Observaciones', seguro(e.observaciones));
    }
    if (evaluaciones.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(GRIS)
        .text('Sin evaluación final registrada.');
    }

    // --- Pie ---
    this.linea(doc);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(GRIS)
      .text(
        `Documento generado el ${new Date().toLocaleString('es-MX')} · Registro físico de la clase espejo #${proyecto.id}`,
        { align: 'center' },
      );

    doc.end();
    return terminado;
  }

  /** Dibuja una línea divisoria tenue. */
  private linea(doc: any): void {
    doc
      .strokeColor('#CCCCCC')
      .lineWidth(0.7)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.6);
  }

  private campo(
    doc: any,
    etiqueta: string,
    valor: string,
    sangria = '',
  ): void {
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor('#333333')
      .text(`${sangria}${etiqueta}: `, { continued: true });
    doc.font('Helvetica').fillColor('#000000').text(valor || '—');
  }
}
