import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  ActivateAccountDto,
  LoginChallenge,
  LoginResponse,
  LoginRespuesta,
  Perfil,
  RegisterDto,
  RegisterResponse,
  TotpConfirmacion,
  TotpEstado,
  TotpInicio,
  Usuario,
} from '../models/auth.models';
import { API_URL } from '../api-url';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'usuario';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function esReto(res: LoginRespuesta): res is LoginChallenge {
  return 'requiereTotp' in res && res.requiereTotp === true;
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

  login(correo: string, password: string): Observable<LoginRespuesta> {
    return this.http.post<LoginRespuesta>(`${API_URL}/auth/login`, { correo, password }).pipe(
      tap((res) => {
        // Con TOTP activo, el primer paso no crea sesión: se guarda el reto
        // en el componente y se pide el código.
        if (!esReto(res)) this.saveSession(res);
      }),
    );
  }

  /** Segundo paso del login: valida TOTP o un código de recuperación. */
  verificarTotp(challengeToken: string, codigo: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_URL}/auth/totp/verificar`, {
        challengeToken,
        codigo,
      })
      .pipe(tap((res) => this.saveSession(res)));
  }

  estadoTotp(): Observable<TotpEstado> {
    return this.http.get<TotpEstado>(`${API_URL}/auth/totp/estado`);
  }

  iniciarTotp(): Observable<TotpInicio> {
    return this.http.post<TotpInicio>(`${API_URL}/auth/totp/iniciar`, {});
  }

  confirmarTotp(codigo: string): Observable<TotpConfirmacion> {
    return this.http.post<TotpConfirmacion>(`${API_URL}/auth/totp/confirmar`, {
      codigo,
    });
  }

  desactivarTotp(
    password: string,
    codigo: string,
  ): Observable<{ habilitado: boolean; mensaje: string }> {
    return this.http.post<{ habilitado: boolean; mensaje: string }>(
      `${API_URL}/auth/totp/desactivar`,
      { password, codigo },
    );
  }

  register(dto: RegisterDto): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${API_URL}/auth/register`, dto);
  }

  /** Deja constancia de la aceptación del aviso para una cuenta existente. */
  aceptarAviso(): Observable<{
    mensaje: string;
    aceptoAvisoVersion: string;
  }> {
    return this.http.post<{
      mensaje: string;
      aceptoAvisoVersion: string;
    }>(`${API_URL}/auth/aceptar-aviso`, {});
  }

  /** Actualiza la sesión local después de aceptar el aviso. */
  marcarAvisoAceptado(version: string): void {
    this.guardarUsuario({
      aceptoAvisoVersion: version,
      debeAceptarAviso: false,
    });
  }

  getPerfil(): Observable<Perfil> {
    return this.http.get<Perfil>(`${API_URL}/usuarios/me`);
  }

  /**
   * Cambia la contraseña. El servidor **cierra las sesiones** al hacerlo
   * (Fase 1), así que quien la cambia debe volver a entrar; eso lo hace la
   * pantalla que llama.
   */
  cambiarPassword(actual: string, nueva: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${API_URL}/usuarios/me/password`, {
      actual,
      nueva,
    });
  }

  /** Pide el enlace de recuperación (la respuesta no revela si la cuenta existe). */
  recuperarPassword(correo: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${API_URL}/auth/recuperar`, { correo });
  }

  /** Comprueba el enlace del correo antes de mostrar el formulario. */
  validarRecuperacion(token: string): Observable<{ valido: boolean; correo: string }> {
    return this.http.get<{ valido: boolean; correo: string }>(`${API_URL}/auth/recuperar/validar`, {
      params: { token },
    });
  }

  /** Restablece la contraseña con el token del correo (de un solo uso). */
  restablecerPassword(token: string, password: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${API_URL}/auth/restablecer`, { token, password });
  }

  /** Confirma el correo con el token del enlace (registro o cambio de correo). */
  confirmarCorreo(token: string): Observable<{ mensaje: string; tipo: string; correo: string }> {
    return this.http.get<{ mensaje: string; tipo: string; correo: string }>(
      `${API_URL}/auth/confirmar-correo`,
      { params: { token } },
    );
  }

  /** Pide otro enlace de confirmación de correo. */
  reenviarConfirmacion(correo: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${API_URL}/auth/confirmar-correo/reenviar`, {
      correo,
    });
  }

  /** Pide cambiar el correo de la cuenta (se confirma en la dirección nueva). */
  solicitarCambioCorreo(correo: string): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${API_URL}/auth/correo`, {
      correo,
    });
  }

  /**
   * Sube la foto de perfil y actualiza la sesión en memoria y en el navegador,
   * para que la barra superior muestre la imagen sin recargar.
   */
  subirFotoPerfil(archivo: File): Observable<{ id: number; fotoUrl: string | null }> {
    const datos = new FormData();
    datos.append('foto', archivo);
    return this.http
      .post<{ id: number; fotoUrl: string | null }>(`${API_URL}/usuarios/me/foto`, datos)
      .pipe(tap((res) => this.guardarUsuario({ fotoUrl: res.fotoUrl })));
  }

  /** Quita la foto de perfil y vuelve a las iniciales. */
  quitarFotoPerfil(): Observable<{ mensaje: string; fotoUrl: null }> {
    return this.http
      .delete<{ mensaje: string; fotoUrl: null }>(`${API_URL}/usuarios/me/foto`)
      .pipe(tap(() => this.guardarUsuario({ fotoUrl: null })));
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

  activarCuenta(dto: ActivateAccountDto): Observable<{ mensaje: string; correo: string }> {
    return this.http.post<{ mensaje: string; correo: string }>(`${API_URL}/auth/activate`, dto);
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

  /** Refresca el usuario guardado (foto, cambio de contraseña) sin recargar. */
  private guardarUsuario(cambios: Partial<Usuario>): void {
    const usuario = this.currentUserSignal();
    if (!usuario) return;
    const actualizado = { ...usuario, ...cambios };
    if (isBrowser()) {
      localStorage.setItem(USER_KEY, JSON.stringify(actualizado));
    }
    this.currentUserSignal.set(actualizado);
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
