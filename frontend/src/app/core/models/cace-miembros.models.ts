import { Rol } from './auth.models';

/**
 * Miembros de la CACE, capacidades y solicitudes de borrado (fase 6).
 *
 * Los tipos viven aquí, y no dentro del servicio, porque los comparten el panel
 * de la CACE y el esqueleto (`app-layout`), que decide qué entradas del menú
 * enseña según las capacidades.
 */

/**
 * Capacidades del usuario que está dentro, tal como las devuelve
 * `GET /cace/capacidades`. Salen de la misma tabla que usa el guardia del
 * servidor, así que la interfaz **esconde** exactamente lo que no se puede
 * hacer y no hay botones que acaben en un 403.
 */
export interface CapacidadesCace {
  rol: Rol;
  /** Etiqueta del rol ya redactada («Secretaría de la CACE»). */
  etiquetaRol: string | null;
  capacidades: string[];
}

/** Miembro de la CACE (presidencia, suplencia o secretaría). */
export interface MiembroCace {
  /** Id de la fila de `MIEMBRO_CACE`: es lo que se manda al activar o desactivar. */
  id: number;
  usuarioId: number;
  nombre: string;
  correo: string;
  /** PRESIDENTE, SUPLENTE o SECRETARIA. */
  cargo: string;
  /** El cargo ya en español, para la lista. */
  etiquetaCargo: string;
  /** Membresía activa: si está apagada, el rol de la CACE no cuenta. */
  activo: boolean;
  /** La cuenta de usuario puede entrar. */
  cuentaActiva: boolean;
  /** Todavía entra con la contraseña provisional. */
  debeCambiarPassword: boolean;
  creadoEn: string;
}

/** Respuesta del alta de una secretaría. */
export interface AltaMiembroCace {
  mensaje: string;
  miembro: MiembroCace;
  /** Verdadero si el correo ya era de un usuario de la plataforma. */
  cuentaExistente: boolean;
  /** Verdadero si el correo con las credenciales salió. */
  correoEnviado: boolean;
  /** Aviso cuando el correo no salió (la contraseña va en la respuesta). */
  avisoCorreo: string | null;
  /**
   * Contraseña provisional. Solo llega cuando el correo **no** se pudo enviar:
   * sin ella y sin correo, la cuenta recién creada quedaría inaccesible.
   */
  passwordProvisional?: string;
}

/** Institución rechazada sobre la que se puede pedir el borrado. */
export interface InstitucionRechazadaCace {
  id: number;
  nombre: string;
  pais: string;
  /** Motivo del rechazo, que ya está en la institución. */
  motivoCace: string;
  /** Id de la solicitud pendiente, si ya hay una (entonces no se puede pedir otra). */
  solicitudPendienteId: number | null;
}

/**
 * Solicitud de borrado de una institución rechazada.
 *
 * La solicitud **sobrevive** al borrado de su institución (es lo que conserva
 * quién lo autorizó y cuándo), así que los datos de la institución pueden llegar
 * en `null`: el servidor no se los inventa y la plantilla escribe «Institución
 * borrada» cuando el nombre no está.
 */
export interface SolicitudBorradoCace {
  id: number;
  /** `null` cuando la institución ya se borró. */
  institucionId: number | null;
  institucionNombre: string | null;
  institucionPais: string | null;
  estadoInstitucion: string | null;
  motivoInstitucion: string | null;
  /** Motivo con el que se pidió el borrado. */
  motivo: string;
  /** PENDIENTE, APROBADA o RECHAZADA. */
  estado: string;
  /** Quién la pidió (la secretaría). */
  solicitadaPor: string;
  solicitadaPorCorreo: string;
  creadoEn: string;
  /** Quién la resolvió (la presidencia) y cuándo. */
  resueltaPor: string | null;
  resueltaEn: string | null;
  /** Verdadero solo en la respuesta del borrado ya ejecutado. */
  institucionBorrada?: boolean;
}

/** Respuesta de `GET /cace/solicitudes-borrado`. */
export interface SolicitudesBorradoCace {
  solicitudes: SolicitudBorradoCace[];
  /** Solo llega a quien puede pedir el borrado (la secretaría). */
  institucionesRechazadas: InstitucionRechazadaCace[];
  /** Cuántas esperan decisión (insignia del menú y de la campana). */
  pendientes: number;
  /** El rol que mira puede aprobar o rechazar. */
  puedeResolver: boolean;
  /** El rol que mira puede pedir el borrado. */
  puedeSolicitar: boolean;
}

/** Respuesta de pedir o resolver una solicitud. */
export interface RespuestaSolicitudBorrado {
  mensaje: string;
  solicitud: SolicitudBorradoCace;
}
