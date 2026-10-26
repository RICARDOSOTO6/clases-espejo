import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api-url';

export interface EnlaceInvitacionAgente {
  mensaje: string;
  id: number;
  enlace: string;
  expiracion: string;
}

export interface InvitacionAgentePendiente {
  id: number;
  creadoEn: string;
  expiracion: string;
}

export interface ActivarAgenteDto {
  token: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  tipoDocumento: string;
  dni: string;
  correo: string;
  password: string;
  aceptaAviso: boolean;
  nombreInstitucion: string;
  pais: string;
  codigoPais: string;
  estado: string;
  ciudad: string;
  telefono: string;
  correoInstitucional: string;
  cargo: string;
}

@Injectable({ providedIn: 'root' })
export class InvitacionesAgenteService {
  private readonly http = inject(HttpClient);

  crear(): Observable<EnlaceInvitacionAgente> {
    return this.http.post<EnlaceInvitacionAgente>(
      `${API_URL}/cace/invitaciones-agente`,
      {},
    );
  }

  listar(): Observable<InvitacionAgentePendiente[]> {
    return this.http.get<InvitacionAgentePendiente[]>(
      `${API_URL}/cace/invitaciones-agente`,
    );
  }

  revocar(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${API_URL}/cace/invitaciones-agente/${id}`,
    );
  }

  validar(token: string): Observable<{ valido: boolean }> {
    return this.http.get<{ valido: boolean }>(
      `${API_URL}/auth/invitacion-agente`,
      { params: { token } },
    );
  }

  activar(
    dto: ActivarAgenteDto,
  ): Observable<{
    mensaje: string;
    usuarioId: number;
    institucion: { id: number; nombre: string; estadoCace: string };
  }> {
    return this.http.post<{
      mensaje: string;
      usuarioId: number;
      institucion: { id: number; nombre: string; estadoCace: string };
    }>(`${API_URL}/auth/activar-agente`, dto);
  }
}
