/**
 * Plazos de revisión de las clases espejo.
 *
 * Una solicitud debe responderse con antelación a la fecha propuesta: si no hay
 * respuesta antes de ese límite, caduca sola por falta de respuesta o de
 * confirmación (las dos etapas de la doble revisión).
 *
 * Todos los cálculos se hacen sobre fechas sin hora (medianoche local) para que
 * la hora del día no cambie el resultado.
 */

/** Niveles de urgencia, de más a menos apremiante. */
export const URGENCIAS = ['VENCIDA', 'CRITICA', 'PROXIMA', 'NORMAL'] as const;
export type Urgencia = (typeof URGENCIAS)[number];

/** Fecha sin hora. */
export function soloFecha(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

/** Días enteros que faltan hasta una fecha (negativo si ya pasó). */
export function diasHasta(fecha: Date, ahora: Date = new Date()): number {
  const MS_DIA = 24 * 60 * 60 * 1000;
  return Math.round(
    (soloFecha(fecha).getTime() - soloFecha(ahora).getTime()) / MS_DIA,
  );
}

/** Urgencia a partir de los días que faltan. */
export function urgenciaSegunDias(
  dias: number,
  critico = 2,
  proximo = 7,
): Urgencia {
  if (dias < 0) return 'VENCIDA';
  if (dias <= critico) return 'CRITICA';
  if (dias <= proximo) return 'PROXIMA';
  return 'NORMAL';
}

/** Urgencia de una fecha concreta. */
export function urgenciaDeFecha(fecha: Date, ahora: Date = new Date()): Urgencia {
  return urgenciaSegunDias(diasHasta(fecha, ahora));
}

/**
 * Días de antelación exigidos para responder una solicitud.
 * Configurable con `REVISION_DIAS_ANTELACION` (por defecto 7).
 */
export function diasAntelacionRevision(): number {
  const valor = Number(process.env.REVISION_DIAS_ANTELACION ?? 7);
  return Number.isFinite(valor) && valor >= 0 ? Math.floor(valor) : 7;
}

/**
 * Último día en el que una solicitud todavía puede responderse:
 * la fecha propuesta menos los días de antelación.
 */
export function fechaLimiteRevision(
  fechaPropuesta: Date,
  dias: number = diasAntelacionRevision(),
): Date {
  const limite = soloFecha(fechaPropuesta);
  limite.setDate(limite.getDate() - dias);
  return limite;
}

/** Fecha (sin hora) a partir de la cual una solicitud ya está caducada. */
export function corteCaducidad(ahora: Date = new Date()): Date {
  const corte = soloFecha(ahora);
  corte.setDate(corte.getDate() + diasAntelacionRevision());
  return corte;
}
