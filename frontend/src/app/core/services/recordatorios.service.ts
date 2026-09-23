import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Agenda } from '../models/recordatorio.models';

const API_URL =
  window.location.port === '4200'
    ? `http://${window.location.hostname}:3000`
    : '';

/**
 * Agenda del usuario: solicitudes por caducar, clases próximas y tareas
 * pendientes. El backend vuelve a comprobar los vencimientos en cada consulta.
 */
@Injectable({ providedIn: 'root' })
export class RecordatoriosService {
  private readonly http = inject(HttpClient);

  obtener(): Observable<Agenda> {
    return this.http.get<Agenda>(`${API_URL}/recordatorios`);
  }
}
