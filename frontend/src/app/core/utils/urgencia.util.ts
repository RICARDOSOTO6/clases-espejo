import { Urgencia } from '../models/recordatorio.models';

/**
 * Texto corto de la marca de urgencia. `dias` son los días que quedan hasta el
 * límite (negativo cuando ya pasó).
 */
export function etiquetaUrgencia(urgencia: Urgencia, dias: number): string {
  const abs = Math.abs(dias);
  switch (urgencia) {
    case 'VENCIDA':
      return dias === 0 ? 'Venció hoy' : `Venció hace ${abs} día${abs === 1 ? '' : 's'}`;
    case 'CRITICA':
      return dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias === 1 ? '' : 's'}`;
    case 'PROXIMA':
      return `Vence en ${dias} día${dias === 1 ? '' : 's'}`;
    default:
      return dias > 0 ? `Quedan ${dias} días` : 'Sin plazo próximo';
  }
}

/** Clase CSS de la marca de urgencia. */
export function claseUrgencia(urgencia: Urgencia): string {
  return `urgencia urgencia--${urgencia.toLowerCase()}`;
}

/** Explicación de qué pasa si no se responde a tiempo. */
export function avisoUrgencia(urgencia: Urgencia): string | null {
  if (urgencia === 'VENCIDA') {
    return 'El plazo terminó: la solicitud se cancela sola por falta de respuesta.';
  }
  if (urgencia === 'CRITICA') {
    return 'Queda muy poco: si nadie responde, la solicitud se cancelará sola.';
  }
  return null;
}
