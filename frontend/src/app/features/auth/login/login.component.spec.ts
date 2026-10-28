import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { IdentidadCaceService } from '../../../core/services/identidad-cace.service';
import {
  LoginChallenge,
  LoginResponse,
  LoginRespuesta,
  Usuario,
} from '../../../core/models/auth.models';

const USUARIO: Usuario = {
  id: 7,
  nombres: 'Ana',
  apellidoPaterno: 'Pérez',
  apellidoMaterno: 'López',
  dni: '12345678',
  tipoDocumento: 'DNI',
  correo: 'ana@prueba.mx',
  activo: true,
  debeCambiarPassword: false,
  debeAceptarAviso: false,
  rol: 'PRESIDENTE_CACE',
};

const RETO: LoginChallenge = {
  requiereTotp: true,
  challengeToken: 'reto-1',
  mensaje: 'Escribe el código de tu aplicación autenticadora.',
};

const SESION: LoginResponse = { access_token: 'token-1', usuario: USUARIO };

describe('LoginComponent con TOTP', () => {
  let auth: {
    login: (correo: string, password: string) => Observable<LoginRespuesta>;
    verificarTotp: (reto: string, codigo: string) => Observable<LoginResponse>;
    currentUser: () => Usuario | null;
    isAuthenticated: boolean;
    reenviarConfirmacion: (correo: string) => Observable<{ mensaje: string }>;
  };
  let router: Router;
  let llamadasVerificacion: Array<[string, string]>;
  let usuarioActual: Usuario | null;

  beforeEach(() => {
    llamadasVerificacion = [];
    usuarioActual = null;
    auth = {
      login: () => of(RETO),
      verificarTotp: (reto, codigo) => {
        llamadasVerificacion.push([reto, codigo]);
        usuarioActual = USUARIO;
        return of(SESION);
      },
      currentUser: () => usuarioActual,
      isAuthenticated: false,
      reenviarConfirmacion: () => of({ mensaje: 'ok' }),
    };

    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        {
          provide: IdentidadCaceService,
          useValue: {
            logo: signal('logo.png'),
            lema: signal('lema'),
            descripcion: signal('descripcion'),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    });
  });

  it('muestra el paso del código cuando el login devuelve un reto', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const componente = fixture.componentInstance;
    componente.form.setValue({ correo: 'ana@prueba.mx', password: 'ClaveSegura1!' });

    componente.submit();
    fixture.detectChanges();

    expect(componente.challenge()?.challengeToken).toBe('reto-1');
    expect(fixture.nativeElement.textContent).toContain('Código de 6 dígitos');
  });

  it('verifica el código y navega al panel', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const componente = fixture.componentInstance;
    router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    componente.form.setValue({ correo: 'ana@prueba.mx', password: 'ClaveSegura1!' });
    componente.submit();
    componente.codigoForm.setValue({ codigo: '123456' });
    componente.verificarCodigo();
    fixture.detectChanges();

    expect(auth.verificarTotp).toBeDefined();
    expect(llamadasVerificacion).toEqual([['reto-1', '123456']]);
    expect(navegar).toHaveBeenCalledWith(['/panel']);
  });
});
