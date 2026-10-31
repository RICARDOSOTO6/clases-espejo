import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  autenticado,
  crearAppE2E,
  iniciarSesion,
  limpiarBase,
  sembrarBase,
  type AppE2E,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('Métricas de rendimiento del piloto (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let tokenPresidente = '';
  let tokenDocente = '';

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
    tokenPresidente = await iniciarSesion(app, semilla.correos.presidencia);
    tokenDocente = await iniciarSesion(app, semilla.correos.docenteA);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reserva las métricas a la CACE', async () => {
    await request(app.getHttpServer())
      .get('/metricas/rendimiento')
      .set(autenticado(tokenDocente))
      .expect(403);
  });

  it('devuelve latencias y tráfico reales de la instancia', async () => {
    await request(app.getHttpServer())
      .get('/proyectos/mios')
      .set(autenticado(tokenDocente))
      .expect(200);

    const respuesta = await request(app.getHttpServer())
      .get('/metricas/rendimiento')
      .set(autenticado(tokenPresidente))
      .expect(200);

    expect(respuesta.body.peticiones.total).toBeGreaterThan(0);
    expect(respuesta.body.proceso).toHaveProperty('rssMb');
    expect(respuesta.body.latenciaMs).toHaveProperty('p95');
    expect(Array.isArray(respuesta.body.rutas)).toBe(true);
    expect(respuesta.body.rutas.length).toBeGreaterThan(0);
  });

  it('entrega el CSV para el informe', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/metricas/rendimiento.csv')
      .set(autenticado(tokenPresidente))
      .expect(200);
    expect(respuesta.headers['content-type']).toContain('text/csv');
    expect(respuesta.text).toContain('peticiones');
  });
});
