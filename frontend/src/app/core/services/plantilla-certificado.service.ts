import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CamposCertificado,
  EstadoPlantillaCertificado,
  PlantillaCertificado,
} from '../models/certificado.models';

const API_URL =
  window.location.port === '4200'
    ? `http://${window.location.hostname}:3000`
    : '';

/** Lo que responde guardar o subir el diseño: la versión nueva ya activa. */
export interface RespuestaPlantilla {
  mensaje: string;
  plantilla: PlantillaCertificado;
}

/** Lo que responde el borrado de una versión suelta. */
export interface RespuestaBorradoPlantilla {
  mensaje: string;
  id: number;
  version: number;
  /** Verdadero si además se borró su imagen de diseño del servidor. */
  archivoBorrado: boolean;
}

/**
 * Plantilla del certificado, del lado de la **presidencia**.
 *
 * Se llama `plantilla` (en singular) para no confundirlo con
 * `plantillas-alumnos`. Aquí no hay `PATCH`: guardar **siempre crea una
 * versión nueva**, porque los certificados ya emitidos apuntan a la versión con
 * la que salieron.
 */
@Injectable({ providedIn: 'root' })
export class PlantillaCertificadoService {
  private readonly http = inject(HttpClient);

  /** Catálogo de datos y todas las versiones. */
  obtener(): Observable<EstadoPlantillaCertificado> {
    return this.http.get<EstadoPlantillaCertificado>(
      `${API_URL}/cace/certificados/plantilla`,
    );
  }

  /** Guarda los cambios como versión nueva (y la deja activa). */
  guardar(dto: {
    campos?: CamposCertificado;
    anchoPx?: number;
    altoPx?: number;
  }): Observable<RespuestaPlantilla> {
    return this.http.post<RespuestaPlantilla>(
      `${API_URL}/cace/certificados/plantilla`,
      dto,
    );
  }

  /** Sube la imagen del diseño; también crea una versión nueva. */
  subirFondo(archivo: File): Observable<RespuestaPlantilla> {
    const datos = new FormData();
    datos.append('fondo', archivo, archivo.name);
    return this.http.post<RespuestaPlantilla>(
      `${API_URL}/cace/certificados/plantilla/fondo`,
      datos,
    );
  }

  /** Vuelve a poner como activa una versión anterior. */
  activar(id: number): Observable<RespuestaPlantilla> {
    return this.http.patch<RespuestaPlantilla>(
      `${API_URL}/cace/certificados/plantilla/${id}/activar`,
      {},
    );
  }

  /**
   * Borra una versión suelta (y su imagen de diseño). El servidor la rechaza
   * con un mensaje claro si es la **activa** o si **algún certificado se emitió**
   * con ella: los emitidos son inmutables y apuntan a su versión.
   */
  eliminar(id: number): Observable<RespuestaBorradoPlantilla> {
    return this.http.delete<RespuestaBorradoPlantilla>(
      `${API_URL}/cace/certificados/plantilla/${id}`,
    );
  }

  /**
   * El QR de un folio, ya generado por el servidor, para la vista previa: así
   * lo que se ve en el panel es exactamente el código que va a salir impreso. Se
   * pide como `blob` porque lleva la sesión en la cabecera (una etiqueta `<img>`
   * no la mandaría).
   */
  qrDeFolio(folio: string): Observable<Blob> {
    return this.http.get(
      `${API_URL}/cace/certificados/plantilla/qr?folio=${encodeURIComponent(folio)}`,
      { responseType: 'blob' },
    );
  }
}
