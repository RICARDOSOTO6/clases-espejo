import { Institucion } from './auth.models';
import { Materia } from './materia.models';

export interface AsignacionMia {
  id: number;
  periodoEscolar: string;
  materia: Materia;
  docenteInstitucion: {
    id: number;
    numeroEmpleado: string;
    activo: boolean;
    institucion: Institucion;
  };
}

export interface RevisionSolicitud {
  id: number;
  etapa: string;
  decision: string;
  comentario: string;
  revisadaEn: string;
}

export interface Solicitud {
  id: number;
  titulo: string;
  objetivo: string;
  fechaPropuesta: string;
  estado: string;
  asignacionOrigen: {
    id: number;
    periodoEscolar: string;
    materia: Materia;
    docenteInstitucion: {
      id: number;
      numeroEmpleado: string;
      activo: boolean;
      institucion: Institucion;
    };
  };
  institucionDestino: Institucion;
  materiaDestino: Materia | null;
  revisiones: RevisionSolicitud[];
}

export interface SolicitudEntrante {
  id: number;
  titulo: string;
  objetivo: string;
  fechaPropuesta: string;
  estado: string;
  asignacionOrigen: {
    id: number;
    periodoEscolar: string;
    materia: Materia;
    docenteInstitucion: {
      id: number;
      numeroEmpleado: string;
      activo: boolean;
      institucion: Institucion;
      docente: {
        id: number;
        gradoAcademico: string;
        especialidad: string;
        usuario: {
          id: number;
          nombres: string;
          apellidoPaterno: string;
          apellidoMaterno: string;
        };
      };
    };
  };
  institucionDestino: Institucion;
  materiaDestino: Materia | null;
  revisiones: RevisionSolicitud[];
}

export interface CreateSolicitudDto {
  asignacionOrigenId: number;
  institucionDestinoId: number;
  materiaDestinoId?: number | null;
  titulo: string;
  objetivo: string;
  fechaPropuesta: string;
}

export interface RevisarSolicitudDto {
  decision: string;
  comentario?: string;
}
