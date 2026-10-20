import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import {
  EditarAlumnoDto,
  GuardarListaDto,
  OrigenLista,
} from './dto/listas-alumnos.dto';

/** Una fila leída de la lista, ya limpia, con lo que haya que avisar. */
interface FilaLista {
  nombre: string;
  matricula: string;
  correo: string;
  avisos: string[];
}

export interface Previsualizacion {
  origen: OrigenLista;
  filas: FilaLista[];
  resumen: {
    total: number;
    listas: number;
    conAvisos: number;
    descartadas: number;
  };
  /** Avisos que no son de una fila concreta (filas repetidas, etc.). */
  avisos: string[];
}

/** Tope sensato: una lista más grande que esto es otra clase espejo. */
const MAXIMO_ALUMNOS = 300;
const MAXIMO_BYTES = 5 * 1024 * 1024;

const CABECERAS_NOMBRE = [
  'nombre',
  'nombres',
  'nombre completo',
  'nombre del alumno',
  'alumno',
  'alumnos',
  'estudiante',
  'estudiantes',
];
const CABECERAS_MATRICULA = [
  'matricula',
  'no de control',
  'numero de control',
  'registro',
  'clave',
  'identificador',
];
const CABECERAS_CORREO = [
  'correo',
  'correo electronico',
  'email',
  'e mail',
  'mail',
];

/** Minúsculas y sin acentos, para comparar encabezados escritos de mil formas. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ¿La celda es el encabezado buscado? Se compara por contenido y no por
 * igualdad, porque los encabezados llevan aclaraciones: «Matrícula (opcional)»
 * o «Correo (opcional, para enviar el certificado)» son los de la plantilla.
 */
function esCabecera(celda: string, opciones: string[]): boolean {
  return opciones.some(
    (opcion) =>
      celda === opcion || celda.startsWith(opcion) || celda.includes(opcion),
  );
}

/** Espacios de más fuera y dentro, sin tocar acentos ni ñ. */
function limpiar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/** El valor de una celda puede ser texto, número, fórmula o texto enriquecido. */
function textoDeCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean')
    return String(valor);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const objeto = valor as Record<string, unknown>;
  if (Array.isArray(objeto['richText'])) {
    return (objeto['richText'] as { text?: string }[])
      .map((parte) => parte?.text ?? '')
      .join('');
  }
  if (typeof objeto['text'] === 'string') return objeto['text'];
  if (objeto['result'] !== undefined) return textoDeCelda(objeto['result']);
  if (Array.isArray(objeto['sharedFormula'])) return '';
  return '';
}

/** Corta una línea por el separador, respetando las comillas. */
function partirLinea(linea: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
      continue;
    }
    if (caracter === separador && !entreComillas) {
      campos.push(actual);
      actual = '';
      continue;
    }
    actual += caracter;
  }
  campos.push(actual);
  return campos;
}

/** El separador más probable de un texto tabulado o separado por comas. */
function detectarSeparador(linea: string): string {
  const candidatos = ['\t', ';', ','];
  let mejor = ',';
  let maximo = 0;
  for (const candidato of candidatos) {
    const veces = linea.split(candidato).length - 1;
    if (veces > maximo) {
      maximo = veces;
      mejor = candidato;
    }
  }
  return mejor;
}

/**
 * Lee las listas de alumnos de una clase espejo y las guarda.
 *
 * Solo el docente que participa en el proyecto puede subir la lista, y la lista
 * es de **su** institución: en una clase espejo hay alumnos de los dos lados y
 * cada docente responde por los suyos.
 */
@Injectable()
export class ListasAlumnosService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Lectura ---

  /** Lee el archivo (o el texto pegado) y devuelve la vista previa. */
  async previsualizar(
    usuarioId: number,
    proyectoId: number,
    archivo?: { buffer: Buffer; originalname: string },
    texto?: string,
  ): Promise<Previsualizacion> {
    await this.contexto(usuarioId, proyectoId);

    if (archivo) {
      const extension = archivo.originalname.toLowerCase().split('.').pop();
      const matriz =
        extension === 'xlsx'
          ? await this.desdeExcel(archivo.buffer)
          : this.desdeTexto(archivo.buffer.toString('utf8'));
      return this.interpretar(matriz, extension === 'xlsx' ? 'EXCEL' : 'CSV');
    }

    if (!texto || !texto.trim()) {
      throw new BadRequestException(
        'Sube un archivo .xlsx o .csv, o pega la lista de alumnos.',
      );
    }
    return this.interpretar(this.desdeTexto(texto), 'PEGADO');
  }

  private async desdeExcel(buffer: Buffer): Promise<string[][]> {
    const libro = new ExcelJS.Workbook();
    try {
      await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        'No se pudo leer el archivo. ¿Seguro que es un Excel (.xlsx)? Si lo guardaste como .xls, ábrelo y guárdalo de nuevo como .xlsx.',
      );
    }

    // Se usa la hoja «Alumnos» si existe (es la de la plantilla); si no, la primera.
    const hoja =
      libro.getWorksheet('Alumnos') ?? libro.worksheets[0] ?? undefined;
    if (!hoja) {
      throw new BadRequestException(
        'El archivo no tiene ninguna hoja con datos.',
      );
    }

    const matriz: string[][] = [];
    hoja.eachRow({ includeEmpty: false }, (fila) => {
      const celdas: string[] = [];
      // `eachCell` respeta los huecos: una fila con la matrícula en la columna C
      // llega con la columna B vacía, que es lo que se espera.
      const total = hoja.columnCount;
      for (let columna = 1; columna <= total; columna += 1) {
        celdas.push(textoDeCelda(fila.getCell(columna).value));
      }
      matriz.push(celdas);
    });
    return matriz;
  }

  private desdeTexto(texto: string): string[][] {
    const lineas = texto
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((linea) => linea.trimEnd())
      .filter((linea) => linea.trim() !== '');
    if (lineas.length === 0) return [];
    const separador = detectarSeparador(lineas[0]);
    return lineas.map((linea) => partirLinea(linea, separador));
  }

  /**
   * Convierte la matriz en filas limpias. Es el mismo camino para Excel, CSV y
   * texto pegado, así que las reglas son idénticas venga de donde venga.
   */
  private interpretar(
    matriz: string[][],
    origen: OrigenLista,
  ): Previsualizacion {
    const filas = matriz
      .map((fila) => fila.map((celda) => limpiar(celda ?? '')))
      .filter((fila) => fila.some((celda) => celda !== ''));

    if (filas.length === 0) {
      throw new BadRequestException('No se encontró ningún dato en la lista.');
    }

    const primera = filas[0].map(normalizar);
    const hayEncabezado = primera.some((celda) =>
      esCabecera(celda, CABECERAS_NOMBRE),
    );

    let indiceNombre = 0;
    let indiceMatricula = 1;
    let indiceCorreo = 2;
    let desde = 0;

    if (hayEncabezado) {
      indiceNombre = primera.findIndex((celda) =>
        esCabecera(celda, CABECERAS_NOMBRE),
      );
      indiceMatricula = primera.findIndex((celda) =>
        esCabecera(celda, CABECERAS_MATRICULA),
      );
      indiceCorreo = primera.findIndex((celda) =>
        esCabecera(celda, CABECERAS_CORREO),
      );
      desde = 1;
      if (indiceNombre < 0) indiceNombre = 0;
    }

    const resultado: FilaLista[] = [];
    const avisos: string[] = [];
    const repetidas = new Set<string>();
    let descartadas = 0;

    for (let i = desde; i < filas.length; i += 1) {
      const fila = filas[i];
      const numero = i + 1;
      const nombre = limpiar(fila[indiceNombre] ?? '');
      const matricula =
        indiceMatricula >= 0 ? limpiar(fila[indiceMatricula] ?? '') : '';
      const correo = indiceCorreo >= 0 ? limpiar(fila[indiceCorreo] ?? '') : '';

      if (!nombre) {
        descartadas += 1;
        avisos.push(`Fila ${numero}: sin nombre, se descartó.`);
        continue;
      }
      if (nombre.length < 3 || !/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(nombre)) {
        descartadas += 1;
        avisos.push(
          `Fila ${numero}: «${nombre}» no parece un nombre, se descartó.`,
        );
        continue;
      }

      const clave = `${normalizar(nombre)}|${normalizar(matricula)}`;
      if (repetidas.has(clave)) {
        descartadas += 1;
        avisos.push(
          `Fila ${numero}: «${nombre}» ya estaba en la lista, se quitó la repetida.`,
        );
        continue;
      }
      repetidas.add(clave);

      const avisosFila: string[] = [];
      let correoLimpio = correo;
      if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        avisosFila.push('El correo no parece válido: se guardará sin correo.');
        correoLimpio = '';
      }

      resultado.push({
        nombre,
        matricula,
        correo: correoLimpio,
        avisos: avisosFila,
      });
    }

    if (resultado.length === 0) {
      throw new BadRequestException(
        'No quedó ningún alumno válido en la lista. Revisa que haya una columna con los nombres.',
      );
    }
    if (resultado.length > MAXIMO_ALUMNOS) {
      throw new BadRequestException(
        `La lista tiene ${resultado.length} alumnos y el máximo es ${MAXIMO_ALUMNOS}. Divídela en dos clases espejo.`,
      );
    }

    if (!hayEncabezado && indiceMatricula === 1) {
      avisos.push(
        'No se encontraron encabezados: se tomó la primera columna como nombre. Si tienes matrícula o correo, usa la plantilla.',
      );
    }

    return {
      origen,
      filas: resultado,
      resumen: {
        total: filas.length - desde,
        listas: resultado.length,
        conAvisos: resultado.filter((fila) => fila.avisos.length > 0).length,
        descartadas,
      },
      avisos,
    };
  }

  // --- Guardado ---

  /** Guarda la lista del docente, reemplazando la que hubiera. */
  async guardar(usuarioId: number, proyectoId: number, dto: GuardarListaDto) {
    const { institucionId } = await this.contexto(usuarioId, proyectoId);

    // Se vuelve a validar en el servidor: el navegador pudo mandar cualquier cosa.
    const filas: FilaLista[] = [];
    const repetidas = new Set<string>();
    for (const alumno of dto.alumnos) {
      const nombre = limpiar(alumno.nombre ?? '');
      if (!nombre || nombre.length < 3) continue;
      const matricula = limpiar(alumno.matricula ?? '');
      const clave = `${normalizar(nombre)}|${normalizar(matricula)}`;
      if (repetidas.has(clave)) continue;
      repetidas.add(clave);
      const correo = limpiar(alumno.correo ?? '');
      filas.push({
        nombre,
        matricula,
        correo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? correo : '',
        avisos: [],
      });
    }

    if (filas.length === 0) {
      throw new BadRequestException('La lista no tiene alumnos válidos.');
    }
    if (filas.length > MAXIMO_ALUMNOS) {
      throw new BadRequestException(
        `La lista tiene ${filas.length} alumnos y el máximo es ${MAXIMO_ALUMNOS}.`,
      );
    }

    const listaId = await this.prisma.$transaction(async (tx) => {
      const lista = await tx.listaAlumnos.upsert({
        where: { proyectoId_institucionId: { proyectoId, institucionId } },
        create: {
          proyectoId,
          institucionId,
          subidaPorUsuarioId: usuarioId,
          origen: dto.origen,
        },
        update: { subidaPorUsuarioId: usuarioId, origen: dto.origen },
      });
      await tx.alumno.deleteMany({ where: { listaId: lista.id } });
      await tx.alumno.createMany({
        data: filas.map((fila, indice) => ({
          listaId: lista.id,
          nombre: fila.nombre,
          matricula: fila.matricula,
          correo: fila.correo,
          orden: indice,
        })),
      });
      return lista.id;
    });

    return this.deLista(listaId);
  }

  /** La lista de la institución del docente, o `null` si todavía no hay. */
  async obtener(usuarioId: number, proyectoId: number) {
    const { institucionId } = await this.contexto(usuarioId, proyectoId);
    const lista = await this.prisma.listaAlumnos.findUnique({
      where: { proyectoId_institucionId: { proyectoId, institucionId } },
    });
    return lista ? this.deLista(lista.id) : null;
  }

  // --- Retoques fila por fila ---

  async editarAlumno(
    usuarioId: number,
    proyectoId: number,
    alumnoId: number,
    dto: EditarAlumnoDto,
  ) {
    const alumno = await this.alumnoDeMiLista(usuarioId, proyectoId, alumnoId);

    const datos: Record<string, unknown> = {};
    if (dto.nombre !== undefined) {
      const nombre = limpiar(dto.nombre);
      if (nombre.length < 3) {
        throw new BadRequestException('El nombre no puede quedar vacío.');
      }
      datos['nombre'] = nombre;
    }
    if (dto.matricula !== undefined)
      datos['matricula'] = limpiar(dto.matricula);
    if (dto.correo !== undefined) {
      const correo = limpiar(dto.correo);
      if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new BadRequestException('Ese correo no parece válido.');
      }
      datos['correo'] = correo;
    }
    if (dto.incluido !== undefined) datos['incluido'] = dto.incluido;

    await this.prisma.alumno.update({
      where: { id: alumno.id },
      data: datos,
    });
    return this.deLista(alumno.listaId);
  }

  async eliminarAlumno(
    usuarioId: number,
    proyectoId: number,
    alumnoId: number,
  ) {
    const alumno = await this.alumnoDeMiLista(usuarioId, proyectoId, alumnoId);
    await this.prisma.alumno.delete({ where: { id: alumno.id } });
    return this.deLista(alumno.listaId);
  }

  // --- Apoyo ---

  /** Comprueba que el usuario es docente del proyecto y devuelve su institución. */
  private async contexto(usuarioId: number, proyectoId: number) {
    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
    });
    if (docente) {
      const participa = await this.prisma.proyectoDocente.findFirst({
        where: {
          proyectoId,
          asignacionDocente: {
            docenteInstitucion: { docenteId: docente.id },
          },
        },
        include: {
          asignacionDocente: { include: { docenteInstitucion: true } },
        },
      });
      if (participa) {
        return {
          institucionId:
            participa.asignacionDocente.docenteInstitucion.institucionId,
        };
      }
      throw new ForbiddenException('No participas en esta clase espejo.');
    }
    throw new ForbiddenException(
      'Solo el docente de la clase espejo puede gestionar la lista de sus alumnos.',
    );
  }

  /** El alumno, comprobando que es de la lista de la institución del docente. */
  private async alumnoDeMiLista(
    usuarioId: number,
    proyectoId: number,
    alumnoId: number,
  ) {
    const { institucionId } = await this.contexto(usuarioId, proyectoId);
    const alumno = await this.prisma.alumno.findFirst({
      where: { id: alumnoId, lista: { proyectoId, institucionId } },
    });
    if (!alumno) {
      throw new NotFoundException(
        'Ese alumno no está en la lista de tu institución.',
      );
    }
    return alumno;
  }

  /** Arma la respuesta: quién la subió, de qué institución y qué alumnos tiene. */
  private async deLista(listaId: number) {
    const lista = await this.prisma.listaAlumnos.findUnique({
      where: { id: listaId },
      include: {
        institucion: { select: { id: true, nombre: true } },
        subidaPor: {
          select: { nombres: true, apellidoPaterno: true },
        },
        alumnos: { orderBy: { orden: 'asc' } },
      },
    });
    if (!lista) throw new NotFoundException('La lista ya no existe.');

    const alumnos = lista.alumnos.map((alumno) => ({
      id: alumno.id,
      nombre: alumno.nombre,
      matricula: alumno.matricula,
      correo: alumno.correo,
      incluido: alumno.incluido,
    }));

    return {
      id: lista.id,
      origen: lista.origen,
      actualizadoEn: lista.actualizadoEn,
      institucion: lista.institucion,
      subidaPor:
        `${lista.subidaPor.nombres} ${lista.subidaPor.apellidoPaterno}`.trim(),
      alumnos,
      resumen: {
        total: alumnos.length,
        incluidos: alumnos.filter((alumno) => alumno.incluido).length,
        sinCorreo: alumnos.filter((alumno) => !alumno.correo).length,
      },
    };
  }

  /** El tamaño máximo del archivo, para el mensaje de error del controlador. */
  static readonly maximoBytes = MAXIMO_BYTES;
}
