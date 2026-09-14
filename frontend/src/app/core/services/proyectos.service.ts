import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateProyectoDocenteDto,
  CreateReportePlanificacionDto,
  Mensaje,
  PlanificacionConjunta,
  Proyecto,
  ReportePlanificacion,
  SavePlanificacionDto,
  UpdateProyectoDto,
} from '../models/proyecto.models';

const API_URL = 'http://localhost:3000';

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
}
