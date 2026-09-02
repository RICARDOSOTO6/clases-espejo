import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InviteDocenteDto, InviteResponse } from '../models/auth.models';

const API_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class AgentesService {
  private readonly http = inject(HttpClient);

  invitarDocente(dto: InviteDocenteDto): Observable<InviteResponse> {
    return this.http.post<InviteResponse>(
      `${API_URL}/agentes/invitar-docente`,
      dto,
    );
  }
}
