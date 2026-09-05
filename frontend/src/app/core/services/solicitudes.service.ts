import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AsignacionMia,
  CreateSolicitudDto,
  Solicitud,
} from '../models/solicitud.models';

const API_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private readonly http = inject(HttpClient);

  misAsignaciones(): Observable<AsignacionMia[]> {
    return this.http.get<AsignacionMia[]>(`${API_URL}/asignaciones/mias`);
  }

  listarMias(): Observable<Solicitud[]> {
    return this.http.get<Solicitud[]>(`${API_URL}/solicitudes/mias`);
  }

  crear(dto: CreateSolicitudDto): Observable<Solicitud> {
    return this.http.post<Solicitud>(`${API_URL}/solicitudes`, dto);
  }

  actualizar(
    id: number,
    dto: Partial<CreateSolicitudDto>,
  ): Observable<Solicitud> {
    return this.http.patch<Solicitud>(`${API_URL}/solicitudes/${id}`, dto);
  }

  cancelar(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${API_URL}/solicitudes/${id}`,
    );
  }
}
