import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DecidirParticipanteDto, ProyectoParticipante } from '../models/proyecto.models';
import { API_URL } from '../api-url';

@Injectable({ providedIn: 'root' })
export class ParticipantesService {
  private readonly http = inject(HttpClient);

  listar(proyectoId: number): Observable<ProyectoParticipante[]> {
    return this.http.get<ProyectoParticipante[]>(
      `${API_URL}/proyectos/${proyectoId}/participantes`,
    );
  }

  invitar(proyectoId: number, institucionId: number): Observable<ProyectoParticipante> {
    return this.http.post<ProyectoParticipante>(
      `${API_URL}/proyectos/${proyectoId}/participantes`,
      { institucionId },
    );
  }

  decidir(
    proyectoId: number,
    participanteId: number,
    dto: DecidirParticipanteDto,
  ): Observable<ProyectoParticipante> {
    return this.http.post<ProyectoParticipante>(
      `${API_URL}/proyectos/${proyectoId}/participantes/${participanteId}/decidir`,
      dto,
    );
  }

  agregarObservador(proyectoId: number, institucionId: number): Observable<ProyectoParticipante> {
    return this.http.post<ProyectoParticipante>(`${API_URL}/proyectos/${proyectoId}/observadores`, {
      institucionId,
    });
  }
}
