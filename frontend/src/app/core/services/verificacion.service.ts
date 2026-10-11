import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VerificacionCertificado } from '../models/certificado.models';

const API_URL =
  window.location.port === '4200'
    ? `http://${window.location.hostname}:3000`
    : '';

/**
 * Verificación pública de un certificado.
 *
 * Es la única llamada de la aplicación que se hace **sin sesión**: la página
 * `/verificar/:folio` la abre cualquiera que escanee el QR de un certificado, y
 * por eso el servidor no devuelve nada más que el nombre del alumno y los datos
 * de la clase —y nada en absoluto si el código no es el correcto—.
 *
 * No hay ninguna llamada que liste certificados: se pregunta por un folio
 * concreto.
 */
@Injectable({ providedIn: 'root' })
export class VerificacionService {
  private readonly http = inject(HttpClient);

  /**
   * El estado de un folio, con el código que va dentro del QR. La respuesta es
   * siempre un 200 con un estado (`VALIDO`, `ANULADO`, `NO_ENCONTRADO` o
   * `INVALIDO`), así que la página no tiene que interpretar códigos de error.
   */
  consultar(
    folio: string,
    codigo: string | null,
  ): Observable<VerificacionCertificado> {
    const parametros = new HttpParams().set('c', codigo ?? '');
    return this.http.get<VerificacionCertificado>(
      `${API_URL}/verificar/${encodeURIComponent(folio)}`,
      { params: parametros },
    );
  }
}
