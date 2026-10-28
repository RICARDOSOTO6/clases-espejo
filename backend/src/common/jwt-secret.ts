/**
 * Valida el secreto de firma de los JWT antes de arrancar.
 *
 * Se exige un mínimo de **32 bytes**. La longitud no demuestra entropía, pero
 * sí evita las frases cortas que caben en un diccionario; la guía de despliegue
 * indica generarlo con `openssl rand -hex 32`.
 */
export function validarSecretoJwt(secreto: string | undefined): string {
  if (!secreto || Buffer.byteLength(secreto, 'utf8') < 32) {
    throw new Error(
      'Falta JWT_SECRET (o mide menos de 32 bytes): genera uno con `openssl rand -hex 32` antes de arrancar.',
    );
  }
  return secreto;
}
