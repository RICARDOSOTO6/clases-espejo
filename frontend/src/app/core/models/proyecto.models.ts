import { Institucion } from './auth.models';
import { Materia } from './materia.models';

interface UsuarioResumen {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo?: string;
}

interface ProyectoDocenteItem {
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
  vistoBueno: boolean;
  observaciones: string;
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

interface SolicitudDeProyecto {
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
  participantes: ProyectoParticipante[];
  planificacion: PlanificacionConjunta | null;
}

export interface ProyectoParticipante {
  id: number;
  institucionId: number;
  institucion: string;
  rol: 'ORIGEN' | 'DESTINO' | 'COLABORADORA' | 'OBSERVADORA';
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CONGELADA';
  congeladoEn: string | null;
  docente: { id: number; nombre: string; apellidos: string } | null;
}

export interface DecidirParticipanteDto {
  decision: 'APROBADA' | 'RECHAZADA';
  asignacionDocenteId?: number;
  motivo?: string;
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
  vistoBueno: boolean;
  observaciones?: string;
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
  archivoUrl: string | null;
  enlaceUrl: string | null;
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

/** Destinatario al que sí le llegó el calendario. */
export interface EnvioCalendarioEntregado {
  nombre: string;
  correo: string;
}

/** Destinatario al que no le llegó, con el motivo tal como lo dio el servidor. */
export interface EnvioCalendarioFallido extends EnvioCalendarioEntregado {
  motivo: string;
}

/**
 * Resultado de `POST /proyectos/:id/calendario/enviar`: se informa de cada
 * envío por separado (no solo «enviado») para que el docente sepa a quién le
 * llegó y a quién no.
 */
export interface EnvioCalendario {
  /** Texto de la respuesta: con la cola, explica que queda encolado. */
  mensaje?: string;
  total: number;
  /** Lote de la cola de correo (Fase 2); se consulta su progreso. */
  loteId?: string;
  /** Cuántos correos quedaron encolados en este lote. */
  encolados?: number;
  enviados: EnvioCalendarioEntregado[];
  fallidos: EnvioCalendarioFallido[];
  /** Sesiones que lleva el archivo, para poder decirlo en la pantalla. */
  sesiones: number;
  nombreArchivo: string;
}
