/**
 * Prueba de humo: la aplicación completa arranca contra la base de pruebas y
 * responde a las rutas públicas sin sesión.
 *
 * Usa la misma base e infraestructura que el resto de suites e2e (base de
 * prueba y correo simulado), así que no envía correos ni toca datos reales.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { crearAppE2E, limpiarBase, type AppE2E } from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('Humo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde ok', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(respuesta.body.status).toBe('ok');
  });

  it('las respuestas llevan cabeceras de seguridad', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['x-frame-options']).toBe('DENY');
    expect(respuesta.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(respuesta.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
  });

  it('las respuestas llevan un identificador de petición', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'prueba-123')
      .expect(200);
    expect(respuesta.headers['x-request-id']).toBe('prueba-123');
  });

  it('GET /cace/publico responde sin sesión', async () => {
    await request(app.getHttpServer()).get('/cace/publico').expect(200);
  });

  it('GET /instituciones/directorio responde sin sesión', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/instituciones/directorio')
      .expect(200);
    expect(Array.isArray(respuesta.body)).toBe(true);
  });

  it('GET /verificar con un folio inventado responde INVALIDO', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/verificar/CACE-2026-0001')
      .query({ c: 'ABCDEFGH' })
      .expect(200);
    expect(respuesta.body.estado).toBe('INVALIDO');
  });
});
