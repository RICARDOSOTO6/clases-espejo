/**
 * Plazos de revisión de las clases espejo.
 *
 * Una solicitud debe responderse con antelación a la fecha propuesta: si no hay
 * respuesta antes de ese límite, caduca sola por falta de respuesta o de
 * confirmación (las dos etapas de la doble revisión).
 *
 * Todas las comparaciones son entre **días de calendario**, nunca entre
 * instantes: las columnas `DATE` del esquema se leen por sus partes UTC (es
 * como las devuelve Prisma) y "hoy" se toma del reloj local del servidor.
 */

/** Niveles de urgencia, de más a menos apremiante. */
export const URGENCIAS = ['VENCIDA', 'CRITICA', 'PROXIMA', 'NORMAL'] as const;
export type Urgencia = (typeof URGENCIAS)[number];

/**
 * Día de calendario del usuario (medianoche UTC): "hoy" para calcular plazos.
 * Se toman las partes **locales** del instante, porque `ahora` sí es un
 * instante real y el día que le importa al usuario es el suyo.
 */
export function diaLocal(ahora: Date = new Date()): Date {
  return new Date(
    Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()),
  );
}

/**
 * Día de calendario de una columna `DATE` del esquema (`fechaPropuesta`,
 * `fechaInicio`, `fechaFin`…).
 *
 * Prisma devuelve esas columnas como **medianoche UTC del día guardado**, así
 * que sus partes buenas son las UTC. Leerlas con `getDate()`/`setHours()`
 * (locales) restaba un día en cualquier huso negativo y, al volver a guardar el
 * formulario, el dato se degradaba. Es el mismo marco para leer, calcular y
 * comparar.
 */
export function diaDeColumna(valor: Date): Date {
  return new Date(
    Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()),
  );
}

/** Texto `YYYY-MM-DD` del día que representa una columna `DATE`. */
export function textoDeColumna(valor: Date): string {
  return diaDeColumna(valor).toISOString().slice(0, 10);
}

/**
 * Días enteros que faltan hasta un día de calendario (columna `DATE`).
 * Negativo si ya pasó.
 */
export function diasHasta(fecha: Date, ahora: Date = new Date()): number {
  const MS_DIA = 24 * 60 * 60 * 1000;
  return Math.round(
    (diaDeColumna(fecha).getTime() - diaLocal(ahora).getTime()) / MS_DIA,
  );
}

/**
 * Días enteros que faltan hasta un instante (columna `TIMESTAMP`, como la hora
 * de una sesión): aquí el día que cuenta es el local.
 */
export function diasHastaInstante(
  fecha: Date,
  ahora: Date = new Date(),
): number {
  const MS_DIA = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(
      Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
    ).getTime() -
      diaLocal(ahora).getTime()) /
      MS_DIA,
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
  const limite = diaDeColumna(fechaPropuesta);
  limite.setUTCDate(limite.getUTCDate() - dias);
  return limite;
}

/** Fecha (sin hora) a partir de la cual una solicitud ya está caducada. */
export function corteCaducidad(ahora: Date = new Date()): Date {
  const corte = diaLocal(ahora);
  corte.setUTCDate(corte.getUTCDate() + diasAntelacionRevision());
  return corte;
}

/** Fecha mínima que se puede proponer: hoy más la antelación exigida. */
export function fechaMinimaPropuesta(ahora: Date = new Date()): Date {
  const minimo = diaLocal(ahora);
  minimo.setUTCDate(minimo.getUTCDate() + diasAntelacionRevision());
  return minimo;
}
