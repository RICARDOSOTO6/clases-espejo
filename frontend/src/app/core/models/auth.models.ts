export type Rol =
  'AGENTE' | 'DOCENTE' | 'SECRETARIA_INSTITUCION' | 'PRESIDENTE_CACE' | 'SECRETARIA_CACE' | null;

export interface Usuario {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  dni: string;
  tipoDocumento: string;
  correo: string;
  /** Ruta de la foto de perfil (por ejemplo `/avatares/avatar-123.png`). */
  fotoUrl?: string | null;
  activo: boolean;
  /**
   * Contraseña provisional pendiente de cambiar (primer acceso del presidente
   * de la CACE). Mientras sea verdadero no se puede usar el resto del panel.
   */
  debeCambiarPassword: boolean;
  rol: Rol;
}

export interface LoginResponse {
  access_token: string;
  usuario: Usuario;
}

export interface RegisterDto {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  tipoDocumento: string;
  dni: string;
  correo: string;
  password: string;
  /** Debe venir en true: sin aceptar el aviso no se crea la cuenta. */
  aceptaAviso: boolean;
  /**
   * Institución existente a la que se une (buscar antes de crear). Cuando viene,
   * los datos de la institución no se envían.
   */
  institucionId?: number | null;
  // Datos de la institución: solo cuando se crea una nueva.
  nombreInstitucion?: string;
  pais?: string;
  codigoPais?: string;
  estado?: string;
  ciudad?: string;
  telefono?: string;
  correoInstitucional?: string;
  cargo: string;
}

export interface RegisterResponse {
  mensaje: string;
  usuario: Usuario;
  institucion?: { id: number; nombre: string; estadoCace: string };
  /**
   * Verdadero cuando el agente se unió a una institución ya aprobada y su alta
   * espera la confirmación de un agente de esa institución.
   */
  requiereConfirmacion?: boolean;
}

/** Institucion tal como la devuelve el backend (con su estado ante la CACE). */
export interface Institucion {
  id: number;
  nombre: string;
  pais: string;
  codigoPais: string;
  estado: string;
  ciudad: string;
  telefono: string;
  correoInstitucional: string;
  registroCompleto: boolean;
  /** Ruta del logo (`/logos/…`), si la institución tiene uno. */
  logoUrl?: string | null;
  /** PENDIENTE, APROBADA, RECHAZADA o VETADA. */
  estadoCace?: string;
  /** Motivo del rechazo o del veto. */
  motivoCace?: string;
  /** Alta del agente confirmada por su institución (null = sin confirmar). */
  confirmadoEn?: string | null;
  /** Falso mientras el agente solo pueda completar los datos de su institución. */
  puedeOperar?: boolean;
  /** Por qué no puede operar todavía, ya redactado. */
  motivoBloqueo?: string | null;
}

/** Fila del directorio público que se usa en el registro. */
export interface InstitucionDirectorio {
  id: number;
  nombre: string;
  pais: string;
  logoUrl: string | null;
  estadoCace: string;
}

/** Alta de un agente pendiente de que la confirme su institución. */
export interface AltaPendiente {
  id: number;
  usuarioId: number;
  nombre: string;
  correo: string;
  cargo: string;
  documento: string;
  creadoEn: string;
}

export interface Perfil {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  dni: string;
  correo: string;
  fotoUrl?: string | null;
  activo: boolean;
  debeCambiarPassword: boolean;
  rol: Rol;
  agente: { id: number; cargo: string; institucion: Institucion } | null;
  miembroCace: { id: number; cargo: string; activo: boolean } | null;
  docente: {
    id: number;
    gradoAcademico: string;
    especialidad: string;
    instituciones: {
      id: number;
      numeroEmpleado: string;
      activo: boolean;
      institucion: Institucion;
    }[];
  } | null;
}

export interface InviteDocenteDto {
  correo: string;
  numeroEmpleado: string;
}

export interface InviteResponse {
  mensaje: string;
  correo: string;
}

export interface ActivateAccountDto {
  token: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  tipoDocumento: string;
  dni: string;
  gradoAcademico: string;
  especialidad: string;
  password: string;
  /** Aceptación del aviso al activar la invitación. */
  aceptaAviso: boolean;
}
