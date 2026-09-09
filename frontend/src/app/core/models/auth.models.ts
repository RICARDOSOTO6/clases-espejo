export type Rol = 'AGENTE' | 'DOCENTE' | null;

export interface Usuario {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  dni: string;
  tipoDocumento: string;
  correo: string;
  activo: boolean;
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
  nombreInstitucion: string;
  pais: string;
  codigoPais: string;
  estado: string;
  ciudad: string;
  telefono: string;
  correoInstitucional: string;
  cargo: string;
}

export interface RegisterResponse {
  mensaje: string;
  usuario: Usuario;
}

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
}

export interface Perfil {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  dni: string;
  correo: string;
  activo: boolean;
  rol: Rol;
  agente: { id: number; cargo: string; institucion: Institucion } | null;
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
}
