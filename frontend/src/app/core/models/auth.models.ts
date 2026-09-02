export type Rol = 'AGENTE' | 'DOCENTE' | null;

export interface Usuario {
  id: number;
  nombres: string;
  apellidos: string;
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
  apellidos: string;
  correo: string;
  password: string;
  nombreInstitucion: string;
  pais: string;
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
  correoInstitucional: string;
}

export interface Perfil {
  id: number;
  nombres: string;
  apellidos: string;
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
  nombres: string;
  apellidos: string;
  email: string;
  gradoAcademico: string;
  especialidad: string;
  numeroEmpleado: string;
}

export interface InviteResponse {
  mensaje: string;
  correo: string;
}
