import { MetricasService } from './metricas.service';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  it('agrega el archivo JSONL cuando se configura el histórico', async () => {
    const carpeta = mkdtempSync(join(tmpdir(), 'metricas-'));
    const archivo = join(carpeta, 'rendimiento.jsonl');
    writeFileSync(
      archivo,
      [
        JSON.stringify({
          fecha: '2026-10-30T10:00:00.000Z',
          metodo: 'GET',
          ruta: '/proyectos/:id',
          estado: 200,
          duracionMs: 10,
        }),
        JSON.stringify({
          fecha: '2026-10-30T10:01:00.000Z',
          metodo: 'GET',
          ruta: '/proyectos/:id',
          estado: 500,
          duracionMs: 30,
        }),
      ].join('\n'),
      'utf8',
    );
    const anterior = process.env.METRICAS_ARCHIVO;
    process.env.METRICAS_ARCHIVO = archivo;
    try {
      const service = new MetricasService();
      const resultado = await service.historicoCsv();
      expect(resultado.alcance).toBe('HISTORICO');
      expect(resultado.desde).toBe('2026-10-30T10:00:00.000Z');
      expect(resultado.csv).toContain('/proyectos/:id');
      expect(resultado.csv).toContain('"1"'); // un error 5xx en la fila
    } finally {
      if (anterior === undefined) delete process.env.METRICAS_ARCHIVO;
      else process.env.METRICAS_ARCHIVO = anterior;
      rmSync(carpeta, { recursive: true, force: true });
    }
  });
});
