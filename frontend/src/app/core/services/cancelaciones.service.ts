import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EstadoCancelacion, SolicitudCancelacionProyecto } from '../models/proyecto.models';
import { API_URL } from '../api-url';

@Injectable({ providedIn: 'root' })
export class CancelacionesService {
  private readonly http = inject(HttpClient);

  estado(proyectoId: number): Observable<EstadoCancelacion> {
    return this.http.get<EstadoCancelacion>(`${API_URL}/proyectos/${proyectoId}/cancelacion`);
  }

  salir(proyectoId: number, motivo: string): Observable<EstadoCancelacion> {
    return this.http.post<EstadoCancelacion>(`${API_URL}/proyectos/${proyectoId}/salir`, {
      motivo,
    });
  }

  solicitar(proyectoId: number, motivo: string): Observable<EstadoCancelacion> {
    return this.http.post<EstadoCancelacion>(`${API_URL}/proyectos/${proyectoId}/cancelacion`, {
      motivo,
    });
  }

  votar(
    proyectoId: number,
    decision: 'APROBADA' | 'RECHAZADA',
    motivo = '',
  ): Observable<EstadoCancelacion> {
    return this.http.post<EstadoCancelacion>(
      `${API_URL}/proyectos/${proyectoId}/cancelacion/votos`,
      { decision, motivo },
    );
  }
}

export type { SolicitudCancelacionProyecto };
