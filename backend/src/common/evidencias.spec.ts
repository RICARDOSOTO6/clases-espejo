import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { validarFirmaEvidencia } from './evidencias';

/**
 * La extensión no decide nada: lo que manda es el contenido. El caso que dio
 * origen a estas pruebas es una persona que sube un archivo llamado
 * `acta.pdf` con texto plano dentro: el sistema tiene que rechazarlo.
 */
describe('validarFirmaEvidencia', () => {
  const directorio = mkdtempSync(join(tmpdir(), 'evidencias-'));
  let contador = 0;

  const archivo = (nombre: string, contenido: Buffer | string): string => {
    const ruta = join(directorio, `${contador++}-${nombre}`);
    writeFileSync(ruta, contenido);
    return ruta;
  };

  const zipCon = async (entradas: Record<string, string>): Promise<Buffer> => {
    const zip = new JSZip();
    for (const [nombre, texto] of Object.entries(entradas)) {
      zip.file(nombre, texto);
    }
    return zip.generateAsync({ type: 'nodebuffer' });
  };

  afterAll(() => {
    rmSync(directorio, { recursive: true, force: true });
  });

  it('rechaza un archivo llamado acta.pdf que en realidad es texto', () => {
    const ruta = archivo(
      'acta.pdf',
      'ACTA DE LA SESIÓN\nAsistentes: 24 estudiantes.\n',
    );

    expect(() => validarFirmaEvidencia(ruta, 'acta.pdf')).toThrow(
      /El contenido no corresponde a un archivo PDF/,
    );
  });

  it('acepta un PDF con su firma al principio', () => {
    const ruta = archivo('acta.pdf', '%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');

    expect(() => validarFirmaEvidencia(ruta, 'acta.pdf')).not.toThrow();
  });

  it('rechaza un .txt con bytes binarios dentro', () => {
    const ruta = archivo('notas.txt', Buffer.from([0x41, 0x00, 0x42]));

    expect(() => validarFirmaEvidencia(ruta, 'notas.txt')).toThrow(
      /datos binarios/,
    );
  });

  it('acepta un .txt de texto plano', () => {
    const ruta = archivo('notas.txt', 'Lista de asistencia');

    expect(() => validarFirmaEvidencia(ruta, 'notas.txt')).not.toThrow();
  });

  it('rechaza una imagen que no es PNG', () => {
    const ruta = archivo('foto.png', 'esto no es una imagen');

    expect(() => validarFirmaEvidencia(ruta, 'foto.png')).toThrow(
      /El contenido no corresponde a un archivo PNG/,
    );
  });

  it('rechaza un WEBP sin la marca WEBP en su cabecera', () => {
    const ruta = archivo(
      'foto.webp',
      Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('NOPE'),
      ]),
    );

    expect(() => validarFirmaEvidencia(ruta, 'foto.webp')).toThrow(
      /no es un WEBP válido/,
    );
  });

  it('rechaza un ZIP renombrado a .docx', async () => {
    const contenido = await zipCon({ 'notas.txt': 'un ZIP cualquiera' });
    const ruta = archivo('acta.docx', contenido);

    expect(() => validarFirmaEvidencia(ruta, 'acta.docx')).toThrow(
      /falta word\/document\.xml/,
    );
  });

  it('acepta un .docx con la parte principal de Word', async () => {
    const contenido = await zipCon({
      '[Content_Types].xml': '<Types/>',
      'word/document.xml': '<w:document/>',
    });
    const ruta = archivo('acta.docx', contenido);

    expect(() => validarFirmaEvidencia(ruta, 'acta.docx')).not.toThrow();
  });

  it('rechaza un ZIP renombrado a .xlsx', async () => {
    const contenido = await zipCon({ 'word/document.xml': '<w:document/>' });
    const ruta = archivo('calificaciones.xlsx', contenido);

    expect(() => validarFirmaEvidencia(ruta, 'calificaciones.xlsx')).toThrow(
      /falta xl\/workbook\.xml/,
    );
  });

  it('acepta un .xlsx con la parte principal de Excel', async () => {
    const contenido = await zipCon({
      '[Content_Types].xml': '<Types/>',
      'xl/workbook.xml': '<workbook/>',
    });
    const ruta = archivo('calificaciones.xlsx', contenido);

    expect(() =>
      validarFirmaEvidencia(ruta, 'calificaciones.xlsx'),
    ).not.toThrow();
  });

  it('acepta el mismo ZIP si de verdad se llama .zip', async () => {
    const contenido = await zipCon({ 'notas.txt': 'un ZIP cualquiera' });
    const ruta = archivo('pruebas.zip', contenido);

    expect(() => validarFirmaEvidencia(ruta, 'pruebas.zip')).not.toThrow();
  });

  it('rechaza una extensión que no admite', () => {
    const ruta = archivo('programa.exe', 'MZ');

    expect(() => validarFirmaEvidencia(ruta, 'programa.exe')).toThrow(
      /No se pudo verificar el tipo de archivo/,
    );
  });
});
