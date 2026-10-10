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

/** Lado mayor admisible del logo, en píxeles. */
const LADO_MAXIMO_LOGO = 512;

/**
 * Prepara el logo de la institución antes de subirlo.
 *
 * A diferencia de la foto de perfil, un logo **no** se recorta en cuadrado (los
 * hay apaisados y verticales) y se guarda en PNG para no perder la
 * transparencia. Solo se reduce si es más grande que el máximo, para que el
 * archivo guardado pese poco.
 */
export async function prepararLogoInstitucion(archivo: File): Promise<File> {
  const imagen = await cargarImagen(archivo);

  const escala = Math.min(
    1,
    LADO_MAXIMO_LOGO / Math.max(imagen.naturalWidth, imagen.naturalHeight),
  );
  const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
  const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d');
  if (!contexto) return archivo;

  contexto.drawImage(imagen, 0, 0, ancho, alto);

  const reducida = await new Promise<Blob | null>((resolve) =>
    lienzo.toBlob((blob) => resolve(blob), 'image/png'),
  );
  if (!reducida) return archivo;

  return new File([reducida], 'logo-institucion.png', { type: 'image/png' });
}
