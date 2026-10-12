import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Institucion, InstitucionDirectorio } from '../models/auth.models';
import { Materia } from '../models/materia.models';
import { API_URL } from '../api-url';

@Injectable({ providedIn: 'root' })
export class InstitucionesService {
  private readonly http = inject(HttpClient);

  listar(): Observable<Institucion[]> {
    return this.http.get<Institucion[]>(`${API_URL}/instituciones`);
  }

  /**
   * Directorio de instituciones para el registro («buscar antes de crear»). Es
   * público: lo usa quien todavía no tiene cuenta.
   */
  directorio(q?: string): Observable<InstitucionDirectorio[]> {
    const params = q?.trim()
      ? new HttpParams().set('q', q.trim())
      : undefined;
    return this.http.get<InstitucionDirectorio[]>(
      `${API_URL}/instituciones/directorio`,
      { params },
    );
  }

  listarMaterias(id: number): Observable<Materia[]> {
    return this.http.get<Materia[]>(`${API_URL}/instituciones/${id}/materias`);
  }

  obtenerMia(): Observable<Institucion> {
    return this.http.get<Institucion>(`${API_URL}/instituciones/mia`);
  }

  actualizarMia(dto: {
    nombre: string;
    pais: string;
    codigoPais: string;
    estado: string;
    ciudad: string;
    telefono: string;
    correoInstitucional: string;
  }): Observable<Institucion> {
    return this.http.patch<Institucion>(`${API_URL}/instituciones/mia`, dto);
  }

  /** Sube el logo de la institución (mismo patrón que la foto de perfil). */
  subirLogo(archivo: File): Observable<Institucion> {
    const datos = new FormData();
    datos.append('logo', archivo);
    return this.http.post<Institucion>(
      `${API_URL}/instituciones/mia/logo`,
      datos,
    );
  }

  /** Quita el logo de la institución. */
  quitarLogo(): Observable<{ mensaje: string; logoUrl: null }> {
    return this.http.delete<{ mensaje: string; logoUrl: null }>(
      `${API_URL}/instituciones/mia/logo`,
    );
  }
}
