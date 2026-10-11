import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';
import { existsSync, unlinkSync } from 'fs';

/**
 * Piezas compartidas para subir imágenes que se sirven **en línea** (logos y
 * fotos de premios).
 *
 * Repite a propósito el criterio del logo de institución: solo imágenes de mapa
 * de bits (PNG, JPG o WEBP) y nunca SVG, porque un SVG puede llevar código
 * dentro y se ejecutaría en el mismo origen que la aplicación. Tenerlo en un
 * solo sitio evita que la próxima carpeta de imágenes se deje una puerta
 * abierta por descuido.
 */

/** Solo imágenes de mapa de bits: nada de SVG ni de documentos. */
export const EXTENSIONES_IMAGEN = ['.png', '.jpg', '.jpeg', '.webp'];

/** Tope de peso de una imagen de identidad: 2 MB de sobra para un logo. */
export const TAMANO_MAXIMO_IMAGEN = 2 * 1024 * 1024;

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
 * Borra del disco la imagen anterior de una URL interna (`/cace-logo/x.png`).
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
