import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AlumnoAGuardar,
  ListaAlumnos,
  OrigenLista,
  PrevisualizacionLista,
} from '../models/lista-alumnos.models';

const API_URL =
  window.location.port === '4200'
    ? `http://${window.location.hostname}:3000`
    : '';

/**
 * Lista de alumnos de una clase espejo, por institución.
 *
 * El docente sube la de su institución; de ahí saldrán los certificados. Se lee
 * primero (`previsualizar`) y solo se guarda cuando el docente revisa la lista.
 */
@Injectable({ providedIn: 'root' })
export class ListasAlumnosService {
  private readonly http = inject(HttpClient);

  /** La lista guardada, o `null` si todavía no hay. */
  obtener(proyectoId: number): Observable<ListaAlumnos | null> {
    return this.http.get<ListaAlumnos | null>(
      `${API_URL}/proyectos/${proyectoId}/listas-alumnos`,
    );
  }

  /** Lee un archivo de Excel o CSV y devuelve la vista previa, sin guardar. */
  previsualizarArchivo(
    proyectoId: number,
    archivo: File,
  ): Observable<PrevisualizacionLista> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<PrevisualizacionLista>(
      `${API_URL}/proyectos/${proyectoId}/listas-alumnos/previsualizar`,
      datos,
    );
  }

  /** Lee la lista pegada a mano (un alumno por línea). */
  previsualizarTexto(
    proyectoId: number,
    texto: string,
  ): Observable<PrevisualizacionLista> {
    return this.http.post<PrevisualizacionLista>(
      `${API_URL}/proyectos/${proyectoId}/listas-alumnos/previsualizar`,
      { texto },
    );
  }

  /** Guarda la lista revisada, reemplazando la anterior si la había. */
  guardar(
    proyectoId: number,
    origen: OrigenLista,
    alumnos: AlumnoAGuardar[],
  ): Observable<ListaAlumnos> {
    return this.http.put<ListaAlumnos>(
      `${API_URL}/proyectos/${proyectoId}/listas-alumnos`,
      { origen, alumnos },
    );
  }

  /** Corrige un alumno o lo deja fuera de los certificados. */
  editarAlumno(
    proyectoId: number,
    alumnoId: number,
    dto: { nombre?: string; matricula?: string; correo?: string; incluido?: boolean },
  ): Observable<ListaAlumnos> {
    return this.http.patch<ListaAlumnos>(
      `${API_URL}/proyectos/${proyectoId}/listas-alumnos/alumnos/${alumnoId}`,
      dto,
    );
  }

  /** Saca a un alumno de la lista. */
  eliminarAlumno(
    proyectoId: number,
    alumnoId: number,
  ): Observable<ListaAlumnos> {
    return this.http.delete<ListaAlumnos>(
      `${API_URL}/proyectos/${proyectoId}/listas-alumnos/alumnos/${alumnoId}`,
    );
  }
}
