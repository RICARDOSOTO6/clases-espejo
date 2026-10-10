import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_URL = window.location.port === '4200' ? `http://${window.location.hostname}:3000` : '';

/** Agente de la institución: es a quien se le avisa de la decisión. */
export interface AgenteContacto {
  nombre: string;
  correo: string;
  cargo: string;
}

/** Fila del panel de instituciones de la presidencia. */
export interface InstitucionCace {
  id: number;
  nombre: string;
  pais: string;
  /** PENDIENTE, APROBADA, RECHAZADA o VETADA. */
  estadoCace: string;
  /** Motivo del rechazo o del veto (vacío si no lo hay). */
  motivoCace: string;
  revisadaEn: string | null;
  revisadaPor: string | null;
  agentes: AgenteContacto[];
  /**
   * Institución ya aprobada que se llama casi igual en el mismo país. Es solo un
   * aviso para que el presidente mire antes de decidir.
   */
  posibleDuplicadoDe: { id: number; nombre: string; pais: string } | null;
}

/** Resultado de aprobar, rechazar, vetar o reactivar. */
export interface DecisionCace {
  mensaje: string;
  id: number;
  nombre: string;
  estadoCace: string;
  motivoCace: string;
  revisadaEn: string | null;
  revisadaPor: string | null;
}

/**
 * Instituciones vistas desde la presidencia de la CACE. Va aparte de
 * `InstitucionesService`, que es el catálogo de agentes y docentes.
 */
@Injectable({ providedIn: 'root' })
export class CaceService {
  private readonly http = inject(HttpClient);

  /** Todas las instituciones, con las pendientes primero. */
  listarInstituciones(): Observable<InstitucionCace[]> {
    return this.http.get<InstitucionCace[]>(`${API_URL}/cace/instituciones`);
  }

  aprobar(id: number): Observable<DecisionCace> {
    return this.http.post<DecisionCace>(`${API_URL}/cace/instituciones/${id}/aprobar`, {});
  }

  rechazar(id: number, motivo: string): Observable<DecisionCace> {
    return this.http.post<DecisionCace>(`${API_URL}/cace/instituciones/${id}/rechazar`, { motivo });
  }

  vetar(id: number, motivo: string): Observable<DecisionCace> {
    return this.http.post<DecisionCace>(`${API_URL}/cace/instituciones/${id}/vetar`, { motivo });
  }

  reactivar(id: number): Observable<DecisionCace> {
    return this.http.post<DecisionCace>(`${API_URL}/cace/instituciones/${id}/reactivar`, {});
  }
}
