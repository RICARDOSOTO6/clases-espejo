/**
 * Fechas que llegan del backend.
 *
 * Hay dos tipos y no se tratan igual:
 *
 * - **Día de calendario** (`fechaPropuesta`, `fechaInicio`, `fechaFin`,
 *   `fechaLimite`): llegan como `2026-03-15T00:00:00.000Z`, o sea medianoche UTC
 *   del día guardado. Si se leen con getters locales, en cualquier huso negativo
 *   (todo América) muestran **un día antes**, y al rellenar con eso un
 *   `<input type="date">` el dato se degrada al guardar. Se tratan como texto.
 * - **Instante** (`fechaHora` de una sesión, `creadoEn`…): es un momento real y
 *   ahí sí corresponde la zona del usuario.
 */

/** Texto `YYYY-MM-DD` del día que representa una fecha de calendario. */
export function fechaTexto(valor: string | Date | null | undefined): string {
  if (!valor) return '';
  if (typeof valor === 'string') return valor.slice(0, 10);
  return valor.toISOString().slice(0, 10);
}

/** Día de hoy como texto, en la zona del navegador. */
export function hoyTexto(ahora: Date = new Date()): string {
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

/** Clave `YYYY-MM-DD` del día **local** en el que cae un instante. */
export function claveLocal(instante: string | Date): string {
  const d = new Date(instante);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fecha legible de un día de calendario: «15 mar 2027». */
export function fechaLarga(valor: string | Date | null | undefined): string {
  const texto = fechaTexto(valor);
  if (!texto) return '';
  // Mediodía local: el huso no puede mover el día al formatear.
  return new Date(`${texto}T12:00:00`).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Fecha y hora de un instante real: «15 mar 2027, 18:00». */
export function fechaHoraLarga(
  valor: string | Date | null | undefined,
): string {
  const d = fechaDeInstante(valor);
  if (!d) return '';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Hora local de un instante: «18:00». */
export function horaTexto(valor: string | Date | null | undefined): string {
  const d = fechaDeInstante(valor);
  if (!d) return '';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function fechaDeInstante(
  valor: string | Date | null | undefined,
): Date | null {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}
