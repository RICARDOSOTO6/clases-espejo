export interface Materia {
  id: number;
  clave: string;
  nombre: string;
  programaEducativo: string;
  descripcion: string;
  activa: boolean;
}

export interface UsuarioDocente {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo: string;
}

export interface DocenteInstitucion {
  id: number;
  numeroEmpleado: string;
  activo: boolean;
  docente: {
    id: number;
    gradoAcademico: string;
    especialidad: string;
    usuario: UsuarioDocente;
  };
}

export interface Asignacion {
  id: number;
  periodoEscolar: string;
  materia: Materia;
  docenteInstitucion: DocenteInstitucion;
}
