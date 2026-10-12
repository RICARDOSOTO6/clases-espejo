/**
 * Descarga un archivo que ya viene como `Blob` (PDF, ZIP, Excel…) sin pasar por
 * el servidor: se crea una URL temporal, se pulsa un enlace invisible y se
 * libera la URL.
 *
 * Estaba escrito dos veces dentro de la pantalla de la clase espejo.
 */
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
