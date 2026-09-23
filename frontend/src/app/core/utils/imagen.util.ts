/**
 * Prepara la foto de perfil antes de subirla.
 *
 * Una foto de móvil puede ser vertical, panorámica o de varios megas: aquí se
 * recorta por el centro en cuadrado y se reduce a 512 px, así el avatar se ve
 * bien en la barra superior y el archivo guardado pesa poco (unas decenas de
 * KB en lugar de varios MB).
 */

/** Lado del cuadrado final, en píxeles. */
const LADO = 512;

export async function prepararFotoPerfil(archivo: File): Promise<File> {
  const imagen = await cargarImagen(archivo);

  const recorte = Math.min(imagen.naturalWidth, imagen.naturalHeight);
  const origenX = (imagen.naturalWidth - recorte) / 2;
  const origenY = (imagen.naturalHeight - recorte) / 2;

  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;
  const contexto = lienzo.getContext('2d');
  if (!contexto) return archivo;

  // Fondo blanco: al convertir a JPEG, la transparencia no debe salir negra.
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, LADO, LADO);
  contexto.drawImage(
    imagen,
    origenX,
    origenY,
    recorte,
    recorte,
    0,
    0,
    LADO,
    LADO,
  );

  const recortada = await new Promise<Blob | null>((resolve) =>
    lienzo.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9),
  );
  if (!recortada) return archivo;

  return new File([recortada], 'foto-perfil.jpg', { type: 'image/jpeg' });
}

/** Carga el archivo como imagen para poder dibujarlo en el lienzo. */
function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    imagen.src = url;
  });
}
