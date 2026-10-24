/**
 * Evidencias por enlace: solo se aceptan https de la lista blanca, sin archivo
 * y sin descargar el enlace en el servidor.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  autenticado,
  crearAppE2E,
  crearProyectoDePrueba,
  iniciarSesion,
  limpiarBase,
  sembrarBase,
  type AppE2E,
  type ProyectoPrueba,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('Evidencias por enlace (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let proyecto: ProyectoPrueba;
  let token: string;

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
    proyecto = await crearProyectoDePrueba(prisma, semilla);
    token = await iniciarSesion(app, semilla.correos.docenteA);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra un enlace de YouTube sin archivo', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/evidencias`)
      .set(autenticado(token))
      .field('tipo', 'Video de la sesión')
      .field('enlaceUrl', 'https://youtu.be/abc123')
      .expect(201);

    expect(respuesta.body.enlaceUrl).toBe('https://youtu.be/abc123');
    expect(respuesta.body.archivoUrl).toBeNull();
    expect(respuesta.body.tipo).toBe('Video de la sesión');
  });

  it('rechaza un dominio que no está en la lista blanca', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/evidencias`)
      .set(autenticado(token))
      .field('enlaceUrl', 'https://example.com/video')
      .expect(400);

    expect(String(respuesta.body.message)).toContain('dominio');
  });

  it('rechaza archivo y enlace en la misma evidencia', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/evidencias`)
      .set(autenticado(token))
      .field('enlaceUrl', 'https://youtu.be/abc123')
      .attach('archivo', Buffer.from('evidencia'), 'evidencia.txt')
      .expect(400);

    expect(String(respuesta.body.message)).toContain('no las dos');
  });
});
