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
  revisiones: unknown[];
}

export interface CreateSolicitudDto {
  asignacionOrigenId: number;
  institucionDestinoId: number;
  materiaDestinoId?: number | null;
  titulo: string;
  objetivo: string;
  fechaPropuesta: string;
}
