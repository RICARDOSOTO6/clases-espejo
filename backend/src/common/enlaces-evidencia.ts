/**
 * Lista blanca de enlaces para evidencias.
 *
 * Solo se aceptan enlaces `https` de proveedores conocidos. No se descarga el
 * enlace en el servidor: se guarda tal cual y se abre en otra pestaña. Así se
 * evita SSRF y no se aloja contenido ajeno.
 */
const DOMINIOS_PERMITIDOS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'vimeo.com',
  'www.vimeo.com',
  'drive.google.com',
  '1drv.ms',
  'onedrive.live.com',
  'www.onedrive.live.com',
]);

export function dominioDeEnlacePermitido(hostname: string): boolean {
  return DOMINIOS_PERMITIDOS.has(hostname.trim().toLowerCase());
}

/**
 * Devuelve la URL normalizada o lanza un error legible. No hace peticiones.
 */
export function validarEnlaceEvidencia(valor: string): string {
  const texto = (valor ?? '').trim();
  if (!texto) {
    throw new Error('El enlace está vacío');
  }
  if (texto.length > 2000) {
    throw new Error('El enlace es demasiado largo');
  }

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    throw new Error('El enlace no es una URL válida');
  }

  if (url.protocol !== 'https:') {
    throw new Error('El enlace debe empezar por https://');
  }
  if (url.username || url.password) {
    throw new Error('El enlace no puede llevar usuario ni contraseña');
  }
  if (url.port && url.port !== '443') {
    throw new Error('El enlace no puede usar un puerto distinto de 443');
  }
  if (!dominioDeEnlacePermitido(url.hostname)) {
    throw new Error(
      'Ese dominio no está permitido. Usa YouTube, Vimeo, Google Drive o OneDrive.',
    );
  }

  // `toString()` normaliza el host y conserva la ruta, la consulta y el ancla.
  return url.toString();
}
