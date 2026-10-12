import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Agenda } from '../models/recordatorio.models';
import { API_URL } from '../api-url';

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
