import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MetricasService } from './metricas.service';

describe('MetricasService', () => {
  let servicio: MetricasService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(MetricasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('descarga el histórico como CSV', () => {
    servicio.descargarHistorico().subscribe((respuesta) => {
      expect(respuesta.body).toBeInstanceOf(Blob);
      expect(respuesta.headers.get('X-Metricas-Alcance')).toBe('HISTORICO');
    });
    const peticion = http.expectOne('/metricas/rendimiento/historico.csv');
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.responseType).toBe('blob');
    peticion.flush(new Blob(['csv']), {
      headers: { 'X-Metricas-Alcance': 'HISTORICO' },
    });
  });
});
