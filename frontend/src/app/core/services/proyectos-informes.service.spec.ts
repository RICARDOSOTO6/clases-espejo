import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProyectosService } from './proyectos.service';

describe('ProyectosService: informes', () => {
  let servicio: ProyectosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ProyectosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('descarga el acta ejecutiva del docente', () => {
    servicio.descargarActaPdf(5).subscribe();
    const peticion = http.expectOne('/proyectos/5/acta-pdf');
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.responseType).toBe('blob');
    peticion.flush(new Blob());
  });

  it('descarga el expediente completo del agente', () => {
    servicio.descargarExpedientePdf(5).subscribe();
    const peticion = http.expectOne('/proyectos/5/expediente-pdf');
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.responseType).toBe('blob');
    peticion.flush(new Blob());
  });
});
