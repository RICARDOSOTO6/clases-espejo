import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  EstadoCertificados,
  ResultadoEmision,
  ResultadoEnvioCertificados,
} from '../models/certificado.models';
import { API_URL } from '../api-url';

/**
 * Certificados de una clase espejo, del lado del **docente**.
 *
 * Emite para los alumnos de la lista de su institución (nunca los de la otra:
 * eso lo comprueba el servidor), descarga los PDF, **anula** con motivo y
 * **envía** el certificado a los alumnos por correo. Las descargas van por
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

  /**
   * Envía por correo el certificado de un alumno, con el PDF adjunto.
   *
   * `reenviar` hay que pedirlo: sin él, a quien ya se le envió no se le manda
   * otra vez y la respuesta lo dice.
   */
  enviarUno(
    proyectoId: number,
    certificadoId: number,
    reenviar = false,
  ): Observable<ResultadoEnvioCertificados> {
    return this.http.post<ResultadoEnvioCertificados>(
      `${API_URL}/proyectos/${proyectoId}/certificados/${certificadoId}/enviar`,
      { reenviar },
    );
  }

  /**
   * Envía los certificados a los alumnos de mi lista: a todos, o solo a los que
   * vengan en `alumnoIds`. Los que no tienen correo se informan aparte.
   */
  enviar(
    proyectoId: number,
    dto: { alumnoIds?: number[]; reenviar?: boolean } = {},
  ): Observable<ResultadoEnvioCertificados> {
    return this.http.post<ResultadoEnvioCertificados>(
      `${API_URL}/proyectos/${proyectoId}/certificados/enviar`,
      dto,
    );
  }

  /** Anula un certificado con su motivo. El motivo es obligatorio. */
  anular(
    proyectoId: number,
    certificadoId: number,
    motivo: string,
  ): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${API_URL}/proyectos/${proyectoId}/certificados/${certificadoId}/anular`,
      { motivo },
    );
  }
}
