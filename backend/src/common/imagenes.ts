import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';
import { closeSync, existsSync, openSync, readSync, unlinkSync } from 'fs';

/**
 * Piezas compartidas para subir imágenes que se sirven **en línea** (logos y
 * fotos de premios) y documentos descargables (el certificado de un premio).
 *
 * Repite a propósito el criterio del logo de institución: solo imágenes de mapa
 * de bits (PNG, JPG o WEBP) y nunca SVG, porque un SVG puede llevar código
 * dentro y se ejecutaría en el mismo origen que la aplicación. Tenerlo en un
 * solo sitio evita que la próxima carpeta de imágenes se deje una puerta
 * abierta por descuido.
 *
 * El certificado de un premio es otra cosa: es un **documento** que se descarga
 * para acreditar el reconocimiento, así que además de las imágenes de mapa de
 * bits admite PDF. Y como ahí no basta con mirar la extensión (renombrar un
 * `.txt` a `.pdf` es trivial), el contenido se comprueba por su firma binaria.
 */

/** Solo imágenes de mapa de bits: nada de SVG ni de documentos. */
const EXTENSIONES_IMAGEN = ['.png', '.jpg', '.jpeg', '.webp'];

/** Tope de peso de una imagen de identidad: 2 MB de sobra para un logo. */
const TAMANO_MAXIMO_IMAGEN = 2 * 1024 * 1024;

/** Documentos que puede ser el certificado de un premio. */
const EXTENSIONES_DOCUMENTO = [...EXTENSIONES_IMAGEN, '.pdf'];

/**
 * Tope de peso del certificado de un premio. Es más alto que el de una imagen
 * porque un certificado escaneado en PDF pesa bastante más que un logo, pero
 * sigue acotado: nadie necesita subir un archivo de decenas de megas.
 */
const TAMANO_MAXIMO_DOCUMENTO = 8 * 1024 * 1024;

/** Los cuatro tipos reales que se admiten como documento de un premio. */
export type TipoDocumento =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'application/pdf';

/** Extensiones que corresponden a cada tipo real. */
const EXTENSIONES_POR_TIPO: Record<TipoDocumento, string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

/**
 * Opciones de multer para una carpeta concreta. El nombre del archivo lleva un
 * prefijo, la marca de tiempo y un aleatorio: así no hay colisiones y no se
 * expone el nombre original de la máquina de quien sube.
 */
export function opcionesImagen(carpeta: string, prefijo: string) {
  return {
    storage: diskStorage({
      destination: carpeta,
      filename: (_req: any, file: any, cb: any) => {
        const nombre = `${prefijo}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(
          file.originalname,
        ).toLowerCase()}`;
        cb(null, nombre);
      },
    }),
    limits: { fileSize: TAMANO_MAXIMO_IMAGEN },
    fileFilter: (_req: any, file: any, cb: any) => {
      const extension = extname(file.originalname).toLowerCase();
      if (!EXTENSIONES_IMAGEN.includes(extension)) {
        return cb(
          new BadRequestException(
            `Formato no permitido (${extension || 'sin extensión'}). La imagen debe ser PNG, JPG o WEBP.`,
          ),
          false,
        );
      }
      cb(null, true);
    },
  };
}

/**
 * Opciones de multer para el **certificado** de un premio: como
 * `opcionesImagen`, pero admitiendo también PDF y con su propio tope de peso.
 *
 * El filtro de aquí solo mira la extensión porque multer decide antes de
 * escribir el archivo; el contenido se comprueba después con
 * `validarDocumentoSubido`, que es quien de verdad impide colar otra cosa.
 */
export function opcionesDocumento(carpeta: string, prefijo: string) {
  const opciones = opcionesImagen(carpeta, prefijo);
  return {
    ...opciones,
    limits: { fileSize: TAMANO_MAXIMO_DOCUMENTO },
    fileFilter: (_req: any, file: any, cb: any) => {
      const extension = extname(file.originalname).toLowerCase();
      if (!EXTENSIONES_DOCUMENTO.includes(extension)) {
        return cb(
          new BadRequestException(
            `Formato no permitido (${extension || 'sin extensión'}). El certificado debe ser PDF, PNG, JPG o WEBP.`,
          ),
          false,
        );
      }
      cb(null, true);
    },
  };
}

/**
 * Tipo real de un archivo, leído de su **firma binaria** (magic bytes) y no de
 * su extensión. Devuelve `null` si no es ninguno de los documentos admitidos.
 */
export function tipoDocumentoReal(ruta: string): TipoDocumento | null {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(ruta, 'r');
    const cabecera = Buffer.alloc(12);
    const leidos = readSync(descriptor, cabecera, 0, cabecera.length, 0);
    if (leidos < 5) return null;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      cabecera
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (cabecera[0] === 0xff && cabecera[1] === 0xd8 && cabecera[2] === 0xff) {
      return 'image/jpeg';
    }
    // WEBP: «RIFF» … «WEBP»
    if (
      cabecera.subarray(0, 4).toString('latin1') === 'RIFF' &&
      cabecera.subarray(8, 12).toString('latin1') === 'WEBP'
    ) {
      return 'image/webp';
    }
    // PDF: «%PDF-»
    if (cabecera.subarray(0, 5).toString('latin1') === '%PDF-') {
      return 'application/pdf';
    }
    return null;
  } catch {
    // Un archivo ilegible es, a efectos prácticos, un archivo no válido.
    return null;
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        // El descriptor se cierra al salir del proceso igualmente.
      }
    }
  }
}

/**
 * Comprueba el **contenido** del documento recién subido: la extensión ya se
 * miró en el filtro, pero renombrar un `.txt` a `.pdf` es trivial. Si lo que
 * hay dentro no es un PDF ni una imagen de mapa de bits (o no coincide con la
 * extensión), se borra el archivo y se rechaza la subida.
 */
export function validarDocumentoSubido(archivo: {
  path: string;
  originalname: string;
}): void {
  const extension = extname(archivo.originalname).toLowerCase();
  const tipo = tipoDocumentoReal(archivo.path);
  if (tipo && EXTENSIONES_POR_TIPO[tipo].includes(extension)) return;

  try {
    unlinkSync(archivo.path);
  } catch {
    // Si no se puede borrar, el rechazo de la subida sigue siendo lo correcto.
  }
  throw new BadRequestException(
    'El archivo no es un documento válido: su contenido no corresponde a un PDF, PNG, JPG o WEBP.',
  );
}

/**
 * Nombre con el que se ofrece un documento al descargarlo, a partir del que
 * traía el archivo subido.
 *
 * Se quitan las barras (para que el nombre no pueda parecer una ruta), las
 * comillas y los saltos de línea (que romperían la cabecera `Content-Disposition`)
 * y se recorta a un tamaño razonable. Además se recupera el UTF-8: multer
 * decodifica el nombre como latin1, así que un «certificación.pdf» llegaría con
 * los acentos rotos.
 */
export function nombreArchivoLegible(original: string): string {
  const recortado = basename(original).trim();
  const enUtf8 = Buffer.from(recortado, 'latin1').toString('utf8');
  const legible = enUtf8.includes('\uFFFD') ? recortado : enUtf8;

  const limpio = legible.replace(/[\\/"\r\n\t]/g, '').trim().slice(0, 200);
  return limpio || 'certificado';
}

/**
 * Cabecera `Content-Disposition` para descargar un documento con su nombre.
 *
 * Va por partida doble a propósito: `filename` en ASCII (para cualquier
 * navegador) y `filename*` en UTF-8 (para que los acentos se vean bien).
 */
export function cabeceraDescarga(nombre: string): string {
  const ascii = nombre
    .normalize('NFD')
    // Se quitan los acentos del nombre ASCII, que es solo el respaldo.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

/**
 * Borra del disco el archivo anterior de una URL interna (`/cace-logo/x.png`).
 * `basename` impide que una ruta manipulada salga de la carpeta, y un fallo al
 * borrar nunca tumba la petición: el archivo huérfano es menos grave que un
 * error al guardar.
 */
export function borrarImagen(carpeta: string, url: string | null): void {
  if (!url) return;
  const ruta = join(carpeta, basename(url));
  if (!existsSync(ruta)) return;
  try {
    unlinkSync(ruta);
  } catch {
    // Si el archivo está en uso, la operación principal ya se hizo.
  }
}
