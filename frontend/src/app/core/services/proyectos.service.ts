import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Actividad,
  CreateEvaluacionDto,
  CreateProyectoDocenteDto,
  CreateReportePlanificacionDto,
  Evaluacion,
  Evidencia,
  Mensaje,
  PlanificacionConjunta,
  Proyecto,
  ReporteClase,
  ReportePlanificacion,
  SavePlanificacionDto,
  SaveReporteClaseDto,
  Sesion,
  UpdateProyectoDto,
} from '../models/proyecto.models';

const API_URL =
  window.location.port === '4200'
    ? `http://${window.location.hostname}:3000`
    : '';

@Injectable({ providedIn: 'root' })
export class ProyectosService {
  private readonly http = inject(HttpClient);

  /** Proyectos en los que participa el docente autenticado. */
  listarMios(): Observable<Proyecto[]> {
    return this.http.get<Proyecto[]>(`${API_URL}/proyectos/mios`);
  }

  /** Proyectos de la institución del agente autenticado. */
  listarInstitucion(): Observable<Proyecto[]> {
    return this.http.get<Proyecto[]>(`${API_URL}/proyectos/institucion`);
  }

  obtener(id: number): Observable<Proyecto> {
    return this.http.get<Proyecto>(`${API_URL}/proyectos/${id}`);
  }

  actualizar(id: number, dto: UpdateProyectoDto): Observable<Proyecto> {
    return this.http.patch<Proyecto>(`${API_URL}/proyectos/${id}`, dto);
  }

  agregarDocente(
    id: number,
    dto: CreateProyectoDocenteDto,
  ): Observable<Proyecto> {
    return this.http.post<Proyecto>(`${API_URL}/proyectos/${id}/docentes`, dto);
  }

  quitarDocente(id: number, proyectoDocenteId: number): Observable<Proyecto> {
    return this.http.delete<Proyecto>(
      `${API_URL}/proyectos/${id}/docentes/${proyectoDocenteId}`,
    );
  }

  guardarPlanificacion(
    id: number,
    dto: SavePlanificacionDto,
  ): Observable<PlanificacionConjunta> {
    return this.http.put<PlanificacionConjunta>(
      `${API_URL}/proyectos/${id}/planificacion`,
      dto,
    );
  }

  confirmarParticipacion(id: number): Observable<PlanificacionConjunta> {
    return this.http.post<PlanificacionConjunta>(
      `${API_URL}/proyectos/${id}/planificacion/confirmar`,
      {},
    );
  }

  listarReportes(id: number): Observable<ReportePlanificacion[]> {
    return this.http.get<ReportePlanificacion[]>(
      `${API_URL}/proyectos/${id}/reportes`,
    );
  }

  generarReporte(
    id: number,
    dto: CreateReportePlanificacionDto,
  ): Observable<ReportePlanificacion> {
    return this.http.post<ReportePlanificacion>(
      `${API_URL}/proyectos/${id}/reportes`,
      dto,
    );
  }

  listarMensajes(id: number): Observable<Mensaje[]> {
    return this.http.get<Mensaje[]>(`${API_URL}/proyectos/${id}/mensajes`);
  }

  enviarMensaje(id: number, contenido: string): Observable<Mensaje> {
    return this.http.post<Mensaje>(`${API_URL}/proyectos/${id}/mensajes`, {
      contenido,
    });
  }

  listarSesiones(id: number): Observable<Sesion[]> {
    return this.http.get<Sesion[]>(`${API_URL}/proyectos/${id}/sesiones`);
  }

  crearSesion(
    id: number,
    dto: { titulo: string; fechaHora: string; enlaceVirtual: string },
  ): Observable<Sesion> {
    return this.http.post<Sesion>(`${API_URL}/proyectos/${id}/sesiones`, dto);
  }

  eliminarSesion(id: number, sesionId: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${API_URL}/proyectos/${id}/sesiones/${sesionId}`,
    );
  }

  listarActividades(id: number): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(`${API_URL}/proyectos/${id}/actividades`);
  }

  crearActividad(
    id: number,
    dto: { titulo: string; instrucciones: string; fechaLimite: string },
  ): Observable<Actividad> {
    return this.http.post<Actividad>(
      `${API_URL}/proyectos/${id}/actividades`,
      dto,
    );
  }

  eliminarActividad(
    id: number,
    actividadId: number,
  ): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${API_URL}/proyectos/${id}/actividades/${actividadId}`,
    );
  }

  listarEvidencias(id: number): Observable<Evidencia[]> {
    return this.http.get<Evidencia[]>(`${API_URL}/proyectos/${id}/evidencias`);
  }

  crearEvidencia(
    id: number,
    archivo: File,
    tipo: string,
    sesionId?: number,
  ): Observable<Evidencia> {
    const formData = new FormData();
    formData.append('archivo', archivo, archivo.name);
    if (tipo) {
      formData.append('tipo', tipo);
    }
    if (sesionId != null) {
      formData.append('sesionId', String(sesionId));
    }
    return this.http.post<Evidencia>(
      `${API_URL}/proyectos/${id}/evidencias`,
      formData,
    );
  }

  // --- Reporte de clase conjunta (Semana 7) ---

  listarReportesClase(id: number): Observable<ReporteClase[]> {
    return this.http.get<ReporteClase[]>(
      `${API_URL}/proyectos/${id}/reportes-clase`,
    );
  }

  guardarReporteClase(
    id: number,
    sesionId: number,
    dto: SaveReporteClaseDto,
  ): Observable<ReporteClase> {
    return this.http.put<ReporteClase>(
      `${API_URL}/proyectos/${id}/sesiones/${sesionId}/reporte`,
      dto,
    );
  }

  confirmarReporteClase(
    id: number,
    reporteId: number,
    observaciones: string,
  ): Observable<ReporteClase> {
    return this.http.post<ReporteClase>(
      `${API_URL}/proyectos/${id}/reportes-clase/${reporteId}/confirmar`,
      { observaciones },
    );
  }

  // --- Evaluación final y cierre (Semana 7) ---

  listarEvaluaciones(id: number): Observable<Evaluacion[]> {
    return this.http.get<Evaluacion[]>(
      `${API_URL}/proyectos/${id}/evaluaciones`,
    );
  }

  crearEvaluacion(
    id: number,
    dto: CreateEvaluacionDto,
  ): Observable<Evaluacion> {
    return this.http.post<Evaluacion>(
      `${API_URL}/proyectos/${id}/evaluaciones`,
      dto,
    );
  }

  cerrarProyecto(id: number): Observable<Proyecto> {
    return this.http.post<Proyecto>(`${API_URL}/proyectos/${id}/cerrar`, {});
  }
}
