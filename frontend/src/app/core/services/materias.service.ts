import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Asignacion,
  DocenteInstitucion,
  Materia,
} from '../models/materia.models';

const API_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class MateriasService {
  private readonly http = inject(HttpClient);

  listarMaterias(): Observable<Materia[]> {
    return this.http.get<Materia[]>(`${API_URL}/materias`);
  }

  crearMateria(dto: {
    clave: string;
    nombre: string;
    programaEducativo: string;
    descripcion: string;
  }): Observable<Materia> {
    return this.http.post<Materia>(`${API_URL}/materias`, dto);
  }

  actualizarMateria(id: number, dto: Partial<Materia>): Observable<Materia> {
    return this.http.patch<Materia>(`${API_URL}/materias/${id}`, dto);
  }

  eliminarMateria(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${API_URL}/materias/${id}`);
  }

  listarDocentes(): Observable<DocenteInstitucion[]> {
    return this.http.get<DocenteInstitucion[]>(`${API_URL}/agentes/docentes`);
  }

  cambiarEstadoDocente(
    id: number,
    activo: boolean,
  ): Observable<DocenteInstitucion> {
    return this.http.patch<DocenteInstitucion>(
      `${API_URL}/agentes/docentes/${id}/estado`,
      { activo },
    );
  }

  eliminarDocente(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${API_URL}/agentes/docentes/${id}`,
    );
  }

  listarAsignaciones(): Observable<Asignacion[]> {
    return this.http.get<Asignacion[]>(`${API_URL}/asignaciones`);
  }

  asignarDocente(dto: {
    docenteInstitucionId: number;
    materiaId: number;
    periodoEscolar: string;
  }): Observable<Asignacion> {
    return this.http.post<Asignacion>(`${API_URL}/asignaciones`, dto);
  }

  quitarAsignacion(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${API_URL}/asignaciones/${id}`,
    );
  }
}
