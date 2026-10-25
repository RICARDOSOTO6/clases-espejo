/**
 * Estados del dominio en un solo lugar.
 *
 * Los usan los DTO (validación) y los servicios (transiciones). El frontend
 * mantiene sus propias etiquetas traducidas para mostrarlos.
 */

// --- Solicitudes y su doble revisión ---
export const ESTADO_SOLICITUD_PENDIENTE = 'PENDIENTE';
export const ESTADO_SOLICITUD_APROBADA_POR_ORIGEN = 'APROBADA_POR_ORIGEN';
export const ESTADO_SOLICITUD_APROBADA = 'APROBADA';
export const ESTADO_SOLICITUD_RECHAZADA = 'RECHAZADA';
/** Venció el plazo de respuesta: la canceló el sistema, no una institución. */
export const ESTADO_SOLICITUD_CADUCADA = 'CADUCADA';

/**
 * Solicitudes que todavía esperan respuesta de alguna institución. Son las
 * únicas que pueden caducar (y las que aparecen en los recordatorios).
 */
export const ESTADOS_SOLICITUD_EN_REVISION: string[] = [
  ESTADO_SOLICITUD_PENDIENTE,
  ESTADO_SOLICITUD_APROBADA_POR_ORIGEN,
];

export const ETAPA_REVISION_ORIGEN = 'REVISION_ORIGEN';
export const ETAPA_REVISION_DESTINO = 'REVISION_DESTINO';

// --- Proyecto ---
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

// --- Instituciones ante la CACE ---
/**
 * Estado de una institución ante la CACE. Es **independiente** de `activa`, que
 * sigue siendo el apagado operativo: una institución aprobada puede estar
 * inactiva (sin agentes activos) y seguir aprobada. Este estado es el que
 * explica **por qué** una institución no puede operar.
 */
export const ESTADO_CACE_PENDIENTE = 'PENDIENTE';
export const ESTADO_CACE_APROBADA = 'APROBADA';
export const ESTADO_CACE_RECHAZADA = 'RECHAZADA';
export const ESTADO_CACE_VETADA = 'VETADA';
/** Baja con historial: no opera, pero no se borra. */
export const ESTADO_CACE_ARCHIVADA = 'ARCHIVADA';

// --- Solicitudes de borrado de una institución (fase 6) ---
/**
 * La secretaría pide el borrado definitivo de una institución rechazada y el
 * presidente lo autoriza. La solicitud nace PENDIENTE y solo se resuelve una
 * vez: aprobada (y entonces se borra) o rechazada (con su motivo).
 */
export const ESTADO_BORRADO_PENDIENTE = 'PENDIENTE';
export const ESTADO_BORRADO_APROBADA = 'APROBADA';
export const ESTADO_BORRADO_RECHAZADA = 'RECHAZADA';

// --- Cargos de los miembros de la CACE ---
/**
 * Cargos de `MIEMBRO_CACE`. La secretaría es la única que no manda en la CACE:
 * presidencia y suplencia comparten capacidades (`common/capacidades.ts`), por
 * eso el rol se resuelve con una sola comparación.
 */
export const CARGO_PRESIDENTE = 'PRESIDENTE';
export const CARGO_SUPLENTE = 'SUPLENTE';
export const CARGO_SECRETARIA = 'SECRETARIA';
