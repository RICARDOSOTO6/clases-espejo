import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

/**
 * Comprobación de firma binaria para las evidencias subidas.
 *
 * La extensión no basta: un `.exe` renombrado a `.pdf` pasaría el filtro de
 * multer. Aquí se leen los primeros bytes y se exige que el contenido
 * corresponda al tipo declarado. Los formatos de texto no tienen firma, pero
 * sí se rechaza contenido binario.
 */

const FIRMAS: Record<string, number[][]> = {
  '.pdf': [[0x25, 0x50, 0x44, 0x46, 0x2d]],
  '.png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  '.jpg': [[0xff, 0xd8, 0xff]],
  '.jpeg': [[0xff, 0xd8, 0xff]],
  '.gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  '.webp': [[0x52, 0x49, 0x46, 0x46]], // además se comprueba WEBP en el byte 8
  '.zip': [[0x50, 0x4b, 0x03, 0x04]],
  '.docx': [[0x50, 0x4b, 0x03, 0x04]],
  '.xlsx': [[0x50, 0x4b, 0x03, 0x04]],
  '.pptx': [[0x50, 0x4b, 0x03, 0x04]],
  '.doc': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  '.xls': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  '.ppt': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
};

const EXTENSIONES_TEXTO = new Set(['.txt', '.csv']);

export function validarFirmaEvidencia(
  ruta: string,
  nombreOriginal: string,
): void {
  const extension = extname(nombreOriginal).toLowerCase();
  if (EXTENSIONES_TEXTO.has(extension)) {
    const contenido = readFileSync(ruta);
    if (contenido.includes(0)) {
      throw new Error(
        'El archivo de texto contiene datos binarios. Adjunta un archivo de texto válido.',
      );
    }
    return;
  }

  const firmas = FIRMAS[extension];
  if (!firmas) {
    throw new Error(
      `No se pudo verificar el tipo de archivo (${extension || 'sin extensión'}).`,
    );
  }

  const cabecera = readFileSync(ruta, { encoding: null }).subarray(0, 16);
  const coincide = firmas.some(
    (firma) =>
      cabecera.length >= firma.length &&
      firma.every((byte, indice) => cabecera[indice] === byte),
  );

  if (extension === '.webp') {
    if (!coincide || cabecera.subarray(8, 12).toString('ascii') !== 'WEBP') {
      throw new Error('El archivo no es un WEBP válido.');
    }
    return;
  }

  if (!coincide) {
    throw new Error(
      `El contenido no corresponde a un archivo ${extension.toUpperCase().replace('.', '')}.`,
    );
  }
}
