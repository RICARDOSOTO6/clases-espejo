/**
 * URL pública de un archivo que sirve el backend (evidencias y avatares).
 *
 * En producción el backend sirve el frontend y la ruta relativa funciona tal
 * cual. En desarrollo el frontend vive en `:4200` y el archivo en el backend
 * (`:3000`), así que la ruta se completa con el host del backend; sin esto el
 * navegador la pide al servidor de desarrollo y recibe el `index.html`, que no
 * es una imagen.
 */
import { API_URL } from '../api-url';

export function urlDeArchivo(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/') && API_URL) {
    return `${API_URL}${url}`;
  }
  return url;
}
