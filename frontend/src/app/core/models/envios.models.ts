/**
 * Progreso de un lote de la cola de correo (Fase 2).
 *
 * Los envíos de certificados y del calendario responden con un `loteId` y se
 * mandan en segundo plano. La pantalla consulta este resumen hasta que
 * `completado` sea verdadero.
 */
export interface ProgresoLote {
  loteId: string;
  total: number;
  pendientes: number;
  enviados: number;
  fallidos: number;
  completado: boolean;
  creadoEn: string | null;
  /** Solo los fallidos, con su motivo, para poder enseñarlos. */
  errores: {
    destinatario: string;
    intentos: number;
    ultimoError: string;
    fallidoEn: string | null;
  }[];
}
