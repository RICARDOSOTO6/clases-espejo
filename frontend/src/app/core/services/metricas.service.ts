import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api-url';

@Injectable({ providedIn: 'root' })
export class MetricasService {
  private readonly http = inject(HttpClient);

  /** Histórico si existe METRICAS_ARCHIVO; si no, acumulado de la instancia. */
  descargarHistorico(): Observable<HttpResponse<Blob>> {
    return this.http.get(`${API_URL}/metricas/rendimiento/historico.csv`, {
      observe: 'response',
      responseType: 'blob',
    });
  }
}
