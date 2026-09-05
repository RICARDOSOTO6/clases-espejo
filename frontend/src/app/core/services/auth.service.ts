import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  ActivateAccountDto,
  LoginResponse,
  Perfil,
  RegisterDto,
  RegisterResponse,
  Usuario,
} from '../models/auth.models';

const API_URL = 'http://localhost:3000';
const TOKEN_KEY = 'access_token';
const USER_KEY = 'usuario';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly currentUserSignal = signal<Usuario | null>(this.readUser());

  readonly currentUser = this.currentUserSignal.asReadonly();

  get token(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  login(correo: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_URL}/auth/login`, { correo, password })
      .pipe(tap((res) => this.saveSession(res)));
  }

  register(dto: RegisterDto): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${API_URL}/auth/register`, dto);
  }

  getPerfil(): Observable<Perfil> {
    return this.http.get<Perfil>(`${API_URL}/usuarios/me`);
  }

  validarTokenInvitacion(
    token: string,
  ): Observable<{ valido: boolean; correo: string; numeroEmpleado: string }> {
    return this.http.get<{
      valido: boolean;
      correo: string;
      numeroEmpleado: string;
    }>(`${API_URL}/auth/activate`, { params: { token } });
  }

  activarCuenta(
    dto: ActivateAccountDto,
  ): Observable<{ mensaje: string; correo: string }> {
    return this.http.post<{ mensaje: string; correo: string }>(
      `${API_URL}/auth/activate`,
      dto,
    );
  }

  logout(): void {
    if (isBrowser()) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.currentUserSignal.set(null);
  }

  private saveSession(res: LoginResponse): void {
    if (isBrowser()) {
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.usuario));
    }
    this.currentUserSignal.set(res.usuario);
  }

  private readUser(): Usuario | null {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Usuario;
    } catch {
      return null;
    }
  }
}
