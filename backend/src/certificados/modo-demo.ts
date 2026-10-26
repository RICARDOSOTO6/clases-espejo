/**
 * ¿Los certificados que se emiten llevan la marca DEMO?
 *
 * Por defecto **sí**: hasta que la CACE apruebe la plantilla y el uso oficial, el
 * certificado no debe poder confundirse con uno definitivo. Para una entrega
 * oficial se arranca con `CERTIFICADO_MODO_DEMO=false`.
 */
export function certificadoModoDemo(): boolean {
  const valor = (process.env.CERTIFICADO_MODO_DEMO ?? 'true')
    .trim()
    .toLowerCase();
  return !['false', '0', 'no', 'off'].includes(valor);
}
