import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  EstadoCertificados,
  ResultadoEmision,
} from '../models/certificado.models';

const API_URL =
  window.location.port === '4200'
    ? `http://${window.location.hostname}:3000`
    : '';

/**
 * Certificados de una clase espejo, del lado del **docente**.
 *
 * Emite para los alumnos de la lista de su institución (nunca los de la otra:
 * eso lo comprueba el servidor) y descarga los PDF. Las descargas van por
 * `HttpClient` y no por una URL directa porque llevan la sesión: los
 * certificados no se sirven como archivos estáticos.
 */
@Injectable({ providedIn: 'root' })
export class CertificadosService {
  private readonly http = inject(HttpClient);

  /** Si se puede emitir, qué falta y qué hay emitido ya. */
  estado(proyectoId: number): Observable<EstadoCertificados> {
    return this.http.get<EstadoCertificados>(
      `${API_URL}/proyectos/${proyectoId}/certificados`,
    );
  }

  /**
   * Emite uno (`alumnoId`) o todos los alumnos incluidos de mi lista.
   *
   * `reemitir` hay que pedirlo a propósito: sin él, un alumno que ya tiene
   * certificado se deja como está y se informa del motivo.
   */
  emitir(
    proyectoId: number,
    dto: { alumnoId?: number; reemitir?: boolean } = {},
  ): Observable<ResultadoEmision> {
    return this.http.post<ResultadoEmision>(
      `${API_URL}/proyectos/${proyectoId}/certificados/emitir`,
      dto,
    );
  }

  /** El PDF de un certificado. */
  descargarPdf(proyectoId: number, certificadoId: number): Observable<Blob> {
    return this.http.get(
      `${API_URL}/proyectos/${proyectoId}/certificados/${certificadoId}/pdf`,
      { responseType: 'blob' },
    );
  }

  /** Todos los certificados vigentes de mi lista, en un ZIP. */
  descargarZip(proyectoId: number): Observable<Blob> {
    return this.http.get(
      `${API_URL}/proyectos/${proyectoId}/certificados/zip`,
      { responseType: 'blob' },
    );
  }
}
