import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api-url';

export interface InstitucionSecretaria {
  id: number;
  nombre: string;
  pais: string;
  codigoPais: string;
  estado: string;
  ciudad: string;
  telefono: string;
  correoInstitucional: string;
  logoUrl: string | null;
  estadoCace: string;
  activa: boolean;
}

export interface PerfilSecretaria {
  institucion: InstitucionSecretaria;
  secretaria: { id: number; activo: boolean };
}

export interface DocenteSecretaria {
  id: number;
  numeroEmpleado: string;
  activo: boolean;
  docenteId: number;
  nombre: string;
  correo: string;
}

export interface ResumenSecretaria {
  docentes: number;
  solicitudes: number;
  proyectos: number;
}

export interface EnlaceInvitacionSecretaria {
  mensaje: string;
  id: number;
  institucion: string;
  correo: string | null;
  correoEnviado: boolean;
  enlace: string;
  expiracion: string;
}

export interface EnlaceInvitacionDocente {
  mensaje: string;
  id: number;
  correo: string;
  correoEnviado: boolean;
  avisoCorreo: string | null;
  enlace: string;
  expiracion: string;
}

export interface ValidacionInvitacionSecretaria {
  valido: boolean;
  correo: string | null;
  institucion: { id: number; nombre: string; pais: string; estadoCace: string };
}

/** Datos del panel de la secretaría de institución y de su invitación. */
@Injectable({ providedIn: 'root' })
export class SecretariasService {
  private readonly http = inject(HttpClient);

  crearInvitacion(correo?: string): Observable<EnlaceInvitacionSecretaria> {
    return this.http.post<EnlaceInvitacionSecretaria>(
      `${API_URL}/secretarias/invitacion`,
      correo ? { correo } : {},
    );
  }

  validarInvitacion(token: string): Observable<ValidacionInvitacionSecretaria> {
    return this.http.get<ValidacionInvitacionSecretaria>(`${API_URL}/auth/invitacion-secretaria`, {
      params: { token },
    });
  }

  activar(dto: {
    token: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    tipoDocumento: string;
    dni: string;
    correo: string;
    password: string;
    aceptaAviso: boolean;
  }): Observable<{ mensaje: string; usuarioId: number; institucion: string }> {
    return this.http.post<{ mensaje: string; usuarioId: number; institucion: string }>(
      `${API_URL}/auth/activar-secretaria`,
      dto,
    );
  }

  perfil(): Observable<PerfilSecretaria> {
    return this.http.get<PerfilSecretaria>(`${API_URL}/secretarias/institucion`);
  }

  actualizarContacto(dto: {
    telefono?: string;
    correoInstitucional?: string;
    estado?: string;
    ciudad?: string;
  }): Observable<{ mensaje: string; institucion: InstitucionSecretaria }> {
    return this.http.patch<{ mensaje: string; institucion: InstitucionSecretaria }>(
      `${API_URL}/secretarias/institucion`,
      dto,
    );
  }

  listarDocentes(): Observable<DocenteSecretaria[]> {
    return this.http.get<DocenteSecretaria[]>(`${API_URL}/secretarias/docentes`);
  }

  invitarDocente(correo: string, numeroEmpleado?: string): Observable<EnlaceInvitacionDocente> {
    return this.http.post<EnlaceInvitacionDocente>(`${API_URL}/secretarias/invitar-docente`, {
      correo,
      numeroEmpleado,
    });
  }

  cambiarEstadoDocente(id: number, activo: boolean): Observable<{ id: number; activo: boolean }> {
    return this.http.patch<{ id: number; activo: boolean }>(
      `${API_URL}/secretarias/docentes/${id}/estado`,
      { activo },
    );
  }

  resumen(): Observable<ResumenSecretaria> {
    return this.http.get<ResumenSecretaria>(`${API_URL}/secretarias/resumen`);
  }
}
