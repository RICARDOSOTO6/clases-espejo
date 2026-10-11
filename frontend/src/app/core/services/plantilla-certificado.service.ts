import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BloqueLegal,
  CamposCertificado,
  EstadoPlantillaCertificado,
  PlantillaCertificado,
} from '../models/certificado.models';

const API_URL =
  window.location.port === '4200'
    ? `http://${window.location.hostname}:3000`
    : '';

/** Lo que responde guardar o subir el fondo: la versión nueva ya activa. */
export interface RespuestaPlantilla {
  mensaje: string;
  plantilla: PlantillaCertificado;
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

  /** Catálogo de datos, firma sugerida y todas las versiones. */
  obtener(): Observable<EstadoPlantillaCertificado> {
    return this.http.get<EstadoPlantillaCertificado>(
      `${API_URL}/cace/certificados/plantilla`,
    );
  }

  /** Guarda los cambios como versión nueva (y la deja activa). */
  guardar(dto: {
    campos?: CamposCertificado;
    textosLegales?: BloqueLegal[];
    firmaNombre?: string;
  }): Observable<RespuestaPlantilla> {
    return this.http.post<RespuestaPlantilla>(
      `${API_URL}/cace/certificados/plantilla`,
      dto,
    );
  }

  /** Sube el fondo; también crea una versión nueva. */
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
}
