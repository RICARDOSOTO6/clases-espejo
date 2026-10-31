import { MetricasService } from './metricas.service';

describe('MetricasService', () => {
  it('acumula latencias, errores y rutas sin guardar datos personales', () => {
    const service = new MetricasService();
    service.registrar({
      metodo: 'GET',
      ruta: '/proyectos/:id',
      estado: 200,
      duracionMs: 10,
    });
    service.registrar({
      metodo: 'GET',
      ruta: '/proyectos/:id',
      estado: 200,
      duracionMs: 30,
    });
    service.registrar({
      metodo: 'POST',
      ruta: '/auth/login',
      estado: 401,
      duracionMs: 20,
    });
    service.registrar({
      metodo: 'POST',
      ruta: '/auth/login',
      estado: 500,
      duracionMs: 40,
      requestId: 'req-1',
    });

    const resumen = service.snapshot();
    expect(resumen.peticiones.total).toBe(4);
    expect(resumen.peticiones.exitosas).toBe(2);
    expect(resumen.peticiones.errores4xx).toBe(1);
    expect(resumen.peticiones.errores5xx).toBe(1);
    expect(resumen.latenciaMs.p95).toBeGreaterThan(0);
    expect(resumen.latenciaMs.max).toBe(40);
    expect(resumen.rutas[0].peticiones).toBeGreaterThan(0);
    expect(resumen.ultimosErrores[0].requestId).toBe('req-1');
    expect(resumen.ultimosErrores[0].ruta).toBe('/auth/login');
  });

  it('exporta el resumen por ruta en CSV', () => {
    const service = new MetricasService();
    service.registrar({
      metodo: 'GET',
      ruta: '/health/detalle',
      estado: 200,
      duracionMs: 5,
    });
    const csv = service.csv();
    expect(csv).toContain('metodo');
    expect(csv).toContain('GET');
    expect(csv).toContain('/health/detalle');
  });
});
