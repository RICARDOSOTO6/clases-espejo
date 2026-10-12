/**
 * Nombre y apellidos de una persona, en una sola línea.
 *
 * Estaba copiado en tres servicios de la CACE (y en un cuarto con una variante
 * que admite que no haya usuario).
 */
export function nombreCompleto(usuario: {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}): string {
  return `${usuario.nombres} ${usuario.apellidoPaterno} ${usuario.apellidoMaterno}`.trim();
}
