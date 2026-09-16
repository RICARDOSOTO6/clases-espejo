import { Institucion } from './auth.models';
import { Materia } from './materia.models';

export interface UsuarioResumen {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo?: string;
}

export interface ProyectoDocenteItem {
  id: number;
  rol: string;
  asignacionDocente: {
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
        usuario: UsuarioResumen;
      };
    };
  };
}

export interface ParticipacionPlanificacion {
  id: number;
  estatusConfirmacion: string;
  confirmadaEn: string | null;
  proyectoDocente: ProyectoDocenteItem;
}

export interface ReportePlanificacion {
  id: number;
  acuerdos: string;
  calendario: string;
  actividadesAcordadas: string;
  generadoEn: string;
}

export interface PlanificacionConjunta {
  id: number;
  proyectoId: number;
  objetivosAcordados: string;
  temasAcordados: string;
  metodologia: string;
  plataforma: string;
  estado: string;
  participaciones: ParticipacionPlanificacion[];
  reportes: ReportePlanificacion[];
}

export interface SolicitudDeProyecto {
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
      institucion: Institucion;
      docente: { usuario: UsuarioResumen };
    };
  };
  institucionDestino: Institucion;
  materiaDestino: Materia | null;
}

export interface Proyecto {
  id: number;
  solicitudId: number;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  plataforma: string;
  solicitud: SolicitudDeProyecto;
  docentes: ProyectoDocenteItem[];
  planificacion: PlanificacionConjunta | null;
}

export interface UpdateProyectoDto {
  estado?: string;
  fechaInicio?: string;
  fechaFin?: string;
  plataforma?: string;
}

export interface CreateProyectoDocenteDto {
  asignacionDocenteId: number;
  rol: string;
}

export interface SavePlanificacionDto {
  objetivosAcordados: string;
  temasAcordados: string;
  metodologia: string;
  plataforma: string;
  estado?: string;
}

export interface CreateReportePlanificacionDto {
  acuerdos: string;
  calendario: string;
  actividadesAcordadas: string;
}

export interface Mensaje {
  id: number;
  contenido: string;
  creadoEn: string;
  autor: {
    id: number;
    rol: string;
    asignacionDocente: {
      docenteInstitucion: {
        docente: { usuario: UsuarioResumen };
      };
    };
  };
}

export interface Sesion {
  id: number;
  titulo: string;
  fechaHora: string;
  enlaceVirtual: string;
  estado: string;
}

export interface Actividad {
  id: number;
  titulo: string;
  instrucciones: string;
  fechaLimite: string;
}

export interface Evidencia {
  id: number;
  tipo: string;
  archivoUrl: string;
  sesionId: number | null;
  registradaEn: string;
}

export interface ParticipacionReporte {
  id: number;
  observaciones: string;
  confirmadoEn: string | null;
  proyectoDocente: ProyectoDocenteItem;
}

export interface ReporteClase {
  id: number;
  sesionId: number;
  desarrolloClase: string;
  totalAsistentes: number;
  incidencias: string;
  acuerdosSiguienteSesion: string;
  estado: string;
  creadoEn: string;
  participaciones: ParticipacionReporte[];
}

export interface SaveReporteClaseDto {
  desarrolloClase: string;
  totalAsistentes: number;
  incidencias: string;
  acuerdosSiguienteSesion: string;
}

export interface Evaluacion {
  id: number;
  proyectoId: number;
  instrumento: string;
  resultado: string;
  observaciones: string;
  creadoEn: string;
}

export interface CreateEvaluacionDto {
  instrumento: string;
  resultado: string;
  observaciones: string;
}
