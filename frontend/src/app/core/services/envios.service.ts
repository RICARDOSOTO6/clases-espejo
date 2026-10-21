import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api-url';
import { ProgresoLote } from '../models/envios.models';

/** Consulta de la cola de correo (Fase 2). */
@Injectable({ providedIn: 'root' })
export class EnviosService {
  private readonly http = inject(HttpClient);

  /** Progreso de un lote. Solo lo ve quien lo pidió. */
  progreso(loteId: string): Observable<ProgresoLote> {
    return this.http.get<ProgresoLote>(
      `${API_URL}/envios/lotes/${encodeURIComponent(loteId)}`,
    );
  }
}
