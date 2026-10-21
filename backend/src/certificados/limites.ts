/**
 * Tope de emisión por clase espejo (Fase 2).
 *
 * Un lote de 300 ya tarda; por encima de 500 deja de ser una clase y es un
 * error de la lista. El límite se comprueba al emitir, antes de generar nada.
 */
export const TOPE_EMISION_POR_CLASE = 500;

export function mensajeTopeEmision(total: number): string {
  return `Una clase espejo no puede emitir más de ${TOPE_EMISION_POR_CLASE} certificados de una vez y esta lista tiene ${total}. Revisa la lista de alumnos o divide la emisión.`;
}
