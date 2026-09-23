import { Institucion } from './auth.models';
import { Materia } from './materia.models';
import { Urgencia } from './recordatorio.models';

/** Plazo de respuesta que calcula el backend para cada solicitud. */
export interface PlazoRevision {
  /** Último día para responder. */
  fechaLimite?: string;
  /** Días que quedan (negativo si ya pasó). */
  diasRestantes?: number;
  urgencia?: Urgencia;
  /** Si todavía espera respuesta de alguna institución. */
  enRevision?: boolean;
}

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

export interface Solicitud extends PlazoRevision {
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

export interface SolicitudEntrante extends PlazoRevision {
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
  asignacionDestino: {
    id: number;
    periodoEscolar: string;
    materia: Materia;
    docenteInstitucion: {
      id: number;
      numeroEmpleado: string;
      activo: boolean;
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
  } | null;
  institucionDestino: Institucion;
  materiaDestino: Materia | null;
  revisiones: RevisionSolicitud[];
  proyecto: { id: number; estado: string } | null;
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
  asignacionDestinoId?: number;
}
