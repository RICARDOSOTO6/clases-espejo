import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Institucion } from '../models/auth.models';
import { Materia } from '../models/materia.models';

const API_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class InstitucionesService {
  private readonly http = inject(HttpClient);

  listar(): Observable<Institucion[]> {
    return this.http.get<Institucion[]>(`${API_URL}/instituciones`);
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
}
