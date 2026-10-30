import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CancelacionesService } from './cancelaciones.service';

describe('CancelacionesService', () => {
  let servicio: CancelacionesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(CancelacionesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta el estado de cancelación', () => {
    servicio.estado(12).subscribe();
    const peticion = http.expectOne('/proyectos/12/cancelacion');
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ estado: 'EN_CURSO', solicitud: null, eventos: [] });
  });

  it('sale de la clase con un motivo', () => {
    servicio.salir(12, 'La institución no puede continuar').subscribe();
    const peticion = http.expectOne('/proyectos/12/salir');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      motivo: 'La institución no puede continuar',
    });
    peticion.flush({ estado: 'CANCELADO', solicitud: null, eventos: [] });
  });

  it('solicita la cancelación de la clase', () => {
    servicio.solicitar(12, 'Cierre acordado').subscribe();
    const peticion = http.expectOne('/proyectos/12/cancelacion');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ motivo: 'Cierre acordado' });
    peticion.flush({ estado: 'EN_CURSO', solicitud: null, eventos: [] });
  });

  it('registra el voto de una institución', () => {
    servicio.votar(12, 'APROBADA', 'De acuerdo').subscribe();
    const peticion = http.expectOne('/proyectos/12/cancelacion/votos');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      decision: 'APROBADA',
      motivo: 'De acuerdo',
    });
    peticion.flush({ estado: 'CANCELADO', solicitud: null, eventos: [] });
  });
});
