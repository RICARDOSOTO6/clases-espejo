/**
 * El mensaje de un error cualquiera, para poder contarlo en un aviso propio.
 *
 * Estaba copiado, idéntico, en los cuatro servicios de la CACE. No es una
 * respuesta al cliente: sirve para explicar **por qué** falló un envío de correo
 * o un alta dentro de otro error, más legible.
 */
export function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
