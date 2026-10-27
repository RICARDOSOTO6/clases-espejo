import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api-url';
import { DesempenoAgente, DesempenoCace } from '../models/desempeno.models';

/** Datos del panel de desempeño de la CACE y del agente. */
@Injectable({ providedIn: 'root' })
export class DesempenoService {
  private readonly http = inject(HttpClient);

  cace(): Observable<DesempenoCace> {
    return this.http.get<DesempenoCace>(`${API_URL}/cace/desempeno`);
  }

  agente(): Observable<DesempenoAgente> {
    return this.http.get<DesempenoAgente>(`${API_URL}/agentes/desempeno`);
  }
}
