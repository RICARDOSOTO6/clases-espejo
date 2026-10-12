import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AltaPendiente,
  InviteDocenteDto,
  InviteResponse,
} from '../models/auth.models';
import { API_URL } from '../api-url';

export interface HistorialClase {
  proyectoId: number;
  titulo: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  plataforma: string;
  rol: string;
  materia: string | null;
  contraparte: string;
  sesiones: number;
  reportesConfirmados: number;
  evaluaciones: {
    instrumento: string;
    resultado: string;
    observaciones: string;
  }[];
}

export interface HistorialDocente {
  docente: {
    id: number;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    correo: string;
    gradoAcademico: string;
    especialidad: string;
    numeroEmpleado: string;
  };
  resumen: {
    total: number;
    finalizadas: number;
    enCurso: number;
    enPlanificacion: number;
    canceladas: number;
  };
  clases: HistorialClase[];
}

@Injectable({ providedIn: 'root' })
export class AgentesService {
  private readonly http = inject(HttpClient);

  invitarDocente(dto: InviteDocenteDto): Observable<InviteResponse> {
    return this.http.post<InviteResponse>(
      `${API_URL}/agentes/invitar-docente`,
      dto,
    );
  }

  /** Historial de clases espejo de un docente (archivero digital). */
  historialDocente(id: number): Observable<HistorialDocente> {
    return this.http.get<HistorialDocente>(
      `${API_URL}/agentes/docentes/${id}/historial`,
    );
  }

  /**
   * Altas pendientes de confirmar en mi institución: las personas que se
   * registraron eligiendo una institución ya aprobada y esperan el visto bueno
   * de un agente de esa institución.
   */
  listarAltasPendientes(): Observable<AltaPendiente[]> {
    return this.http.get<AltaPendiente[]>(`${API_URL}/agentes/confirmaciones`);
  }

  confirmarAlta(id: number): Observable<{ mensaje: string; id: number }> {
    return this.http.post<{ mensaje: string; id: number }>(
      `${API_URL}/agentes/confirmaciones/${id}/confirmar`,
      {},
    );
  }

  rechazarAlta(
    id: number,
    motivo: string,
  ): Observable<{ mensaje: string; id: number }> {
    return this.http.post<{ mensaje: string; id: number }>(
      `${API_URL}/agentes/confirmaciones/${id}/rechazar`,
      { motivo },
    );
  }
}
