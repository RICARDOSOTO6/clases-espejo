import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { LoginResponse, Usuario } from '../models/auth.models';

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
  rol: 'DOCENTE',
};

describe('AuthService', () => {
  let servicio: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('guarda la sesión cuando el login no pide TOTP', () => {
    const respuesta: LoginResponse = { access_token: 'token-1', usuario: USUARIO };
    servicio.login('ana@prueba.mx', 'ClaveSegura1!').subscribe((res) => {
      expect('access_token' in res && res.access_token).toBe('token-1');
    });

    const peticion = http.expectOne('/auth/login');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      correo: 'ana@prueba.mx',
      password: 'ClaveSegura1!',
    });
    peticion.flush(respuesta);

    expect(servicio.token).toBe('token-1');
    expect(servicio.currentUser()?.correo).toBe('ana@prueba.mx');
  });

  it('no crea sesión cuando el login devuelve un reto TOTP', () => {
    servicio.login('ana@prueba.mx', 'ClaveSegura1!').subscribe((res) => {
      expect('requiereTotp' in res && res.requiereTotp).toBe(true);
    });

    const peticion = http.expectOne('/auth/login');
    peticion.flush({
      requiereTotp: true,
      challengeToken: 'reto-1',
      mensaje: 'Escribe el código',
    });

    expect(servicio.token).toBeNull();
    expect(servicio.currentUser()).toBeNull();
  });

  it('guarda la sesión al verificar el código TOTP', () => {
    servicio.verificarTotp('reto-1', '123456').subscribe();
    const peticion = http.expectOne('/auth/totp/verificar');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      challengeToken: 'reto-1',
      codigo: '123456',
    });
    peticion.flush({ access_token: 'token-2', usuario: USUARIO });

    expect(servicio.token).toBe('token-2');
    expect(servicio.isAuthenticated).toBe(true);
  });

  it('limpia la sesión al cerrar sesión', () => {
    servicio.login('ana@prueba.mx', 'ClaveSegura1!').subscribe();
    http.expectOne('/auth/login').flush({ access_token: 'token-1', usuario: USUARIO });
    expect(servicio.isAuthenticated).toBe(true);

    servicio.logout();

    expect(servicio.token).toBeNull();
    expect(servicio.currentUser()).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('consulta el estado TOTP', () => {
    servicio.estadoTotp().subscribe((estado) => {
      expect(estado.habilitado).toBe(false);
      expect(estado.codigosRestantes).toBe(0);
    });
    const peticion = http.expectOne('/auth/totp/estado');
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ habilitado: false, confirmadoEn: null, codigosRestantes: 0 });
  });

  it('inicia la configuración TOTP con POST', () => {
    servicio.iniciarTotp().subscribe((inicio) => {
      expect(inicio.secreto).toBe('SECRETO');
    });
    const peticion = http.expectOne('/auth/totp/iniciar');
    expect(peticion.request.method).toBe('POST');
    peticion.flush({
      secreto: 'SECRETO',
      uri: 'otpauth://totp/x',
      qrDataUrl: 'data:image/png;base64,abc',
      mensaje: 'ok',
    });
  });

  it('confirma TOTP con el código escrito', () => {
    servicio.confirmarTotp('123456').subscribe((res) => {
      expect(res.codigosRecuperacion).toEqual(['AAAA-BBBB']);
    });
    const peticion = http.expectOne('/auth/totp/confirmar');
    expect(peticion.request.body).toEqual({ codigo: '123456' });
    peticion.flush({
      habilitado: true,
      codigosRecuperacion: ['AAAA-BBBB'],
      mensaje: 'ok',
    });
  });

  it('desactiva TOTP con contraseña y código', () => {
    servicio.desactivarTotp('ClaveSegura1!', '123456').subscribe((res) => {
      expect(res.habilitado).toBe(false);
    });
    const peticion = http.expectOne('/auth/totp/desactivar');
    expect(peticion.request.body).toEqual({
      password: 'ClaveSegura1!',
      codigo: '123456',
    });
    peticion.flush({ habilitado: false, mensaje: 'ok' });
  });
});
