/**
 * Estados del dominio en un solo lugar.
 *
 * Los usan los DTO (validación) y los servicios (transiciones). El frontend
 * mantiene sus propias etiquetas traducidas para mostrarlos.
 */

// --- Solicitudes y su doble revisión ---
export const ESTADOS_SOLICITUD = [
  'PENDIENTE',
  'APROBADA_POR_ORIGEN',
  'APROBADA',
  'RECHAZADA',
];
export const ESTADO_SOLICITUD_PENDIENTE = 'PENDIENTE';
export const ESTADO_SOLICITUD_APROBADA_POR_ORIGEN = 'APROBADA_POR_ORIGEN';
export const ESTADO_SOLICITUD_APROBADA = 'APROBADA';
export const ESTADO_SOLICITUD_RECHAZADA = 'RECHAZADA';

export const ETAPAS_REVISION = ['REVISION_ORIGEN', 'REVISION_DESTINO'];
export const ETAPA_REVISION_ORIGEN = 'REVISION_ORIGEN';
export const ETAPA_REVISION_DESTINO = 'REVISION_DESTINO';

// --- Proyecto ---
export const ESTADOS_PROYECTO = [
  'EN_PLANIFICACION',
  'EN_CURSO',
  'FINALIZADO',
  'CANCELADO',
];
export const ESTADO_PROYECTO_INICIAL = 'EN_PLANIFICACION';
export const ESTADO_PROYECTO_FINALIZADO = 'FINALIZADO';
export const ESTADO_PROYECTO_CANCELADO = 'CANCELADO';

/**
 * Estados que el docente puede fijar desde "Datos del proyecto".
 * `FINALIZADO` queda reservado al cierre, que sí valida requisitos.
 */
export const ESTADOS_PROYECTO_EDITABLES = ['EN_PLANIFICACION', 'EN_CURSO'];

// --- Planificación ---
export const ESTADOS_PLANIFICACION = ['BORRADOR', 'EN_REVISION', 'APROBADA'];
export const ESTADO_PLANIFICACION_INICIAL = 'BORRADOR';

// --- Reporte de clase ---
export const ESTADOS_REPORTE_CLASE = ['BORRADOR', 'EN_REVISION', 'CONFIRMADO'];
export const ESTADO_REPORTE_BORRADOR = 'BORRADOR';
export const ESTADO_REPORTE_EN_REVISION = 'EN_REVISION';
export const ESTADO_REPORTE_CONFIRMADO = 'CONFIRMADO';

// --- Sesiones ---
export const ESTADOS_SESION = [
  'PROGRAMADA',
  'EN_CURSO',
  'FINALIZADA',
  'CANCELADA',
];
export const ESTADO_SESION_INICIAL = 'PROGRAMADA';
export const ESTADO_SESION_CANCELADA = 'CANCELADA';

// --- Confirmaciones ---
export const ESTATUS_PENDIENTE = 'PENDIENTE';
export const ESTATUS_CONFIRMADA = 'CONFIRMADA';
