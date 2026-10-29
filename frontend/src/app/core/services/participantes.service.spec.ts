import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ParticipantesService } from './participantes.service';

describe('ParticipantesService', () => {
  let servicio: ParticipantesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ParticipantesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las instituciones participantes', () => {
    servicio.listar(12).subscribe((lista) => {
      expect(lista).toEqual([]);
    });
    const peticion = http.expectOne('/proyectos/12/participantes');
    expect(peticion.request.method).toBe('GET');
    peticion.flush([]);
  });

  it('consulta las invitaciones pendientes del agente', () => {
    servicio.pendientes().subscribe((lista) => {
      expect(lista).toEqual([]);
    });
    const peticion = http.expectOne('/participaciones/pendientes');
    expect(peticion.request.method).toBe('GET');
    peticion.flush([]);
  });

  it('invita a una institución', () => {
    servicio.invitar(12, 8).subscribe();
    const peticion = http.expectOne('/proyectos/12/participantes');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ institucionId: 8 });
    peticion.flush({ id: 3, estado: 'PENDIENTE' });
  });

  it('aprueba una participación con el docente elegido', () => {
    servicio.decidir(12, 3, { decision: 'APROBADA', asignacionDocenteId: 9 }).subscribe();
    const peticion = http.expectOne('/proyectos/12/participantes/3/decidir');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ decision: 'APROBADA', asignacionDocenteId: 9 });
    peticion.flush({ id: 3, estado: 'APROBADA' });
  });

  it('agrega una observadora después del cierre', () => {
    servicio.agregarObservador(12, 10).subscribe();
    const peticion = http.expectOne('/proyectos/12/observadores');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ institucionId: 10 });
    peticion.flush({ id: 4, rol: 'OBSERVADORA' });
  });
});
