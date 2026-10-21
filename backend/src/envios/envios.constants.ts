/**
 * Reglas de la cola de correo (Fase 2).
 *
 * La espera es **creciente**: tras el primer fallo se reintenta al minuto, luego
 * a los 5, a los 15 y a la hora. A los `MAX_INTENTOS` la fila queda `FALLIDO`
 * con el motivo, sin bloquear al resto del lote.
 */
export const MAX_INTENTOS_ENVIO = 5;

export const ESPERAS_REINTENTO_MINUTOS = [1, 5, 15, 60] as const;

/** Cuántos correos procesa cada pasada del worker. */
export const ENVIOS_POR_TANDA = 25;

/** Cada cuánto vacía la cola el worker (se puede bajar en pruebas). */
export const INTERVALO_WORKER_MS = Number(
  process.env.ENVIOS_INTERVALO_MS ?? 60_000,
);

/** Minutos de espera antes del siguiente intento, según los fallos acumulados. */
export function esperaReintentoMinutos(intentos: number): number {
  const indice = Math.max(
    1,
    Math.min(intentos, ESPERAS_REINTENTO_MINUTOS.length),
  );
  return ESPERAS_REINTENTO_MINUTOS[indice - 1];
}
