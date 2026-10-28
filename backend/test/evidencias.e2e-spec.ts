/**
 * Evidencias por enlace: solo se aceptan https de la lista blanca, sin archivo
 * y sin descargar el enlace en el servidor.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { unlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
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

  it('rechaza un PDF cuyo contenido no es PDF', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/evidencias`)
      .set(autenticado(token))
      .attach('archivo', Buffer.from('esto no es un PDF'), 'falso.pdf')
      .expect(400);

    expect(String(respuesta.body.message)).toContain('contenido');
  });

  it('acepta un PDF con firma válida y guarda la evidencia', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/evidencias`)
      .set(autenticado(token))
      .attach(
        'archivo',
        Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'),
        'evidencia.pdf',
      )
      .expect(201);

    expect(respuesta.body.archivoUrl).toMatch(/^\/uploads\/.+\.pdf$/);

    // La prueba no debe dejar basura en uploads.
    const nombre = basename(String(respuesta.body.archivoUrl));
    try {
      unlinkSync(join(process.cwd(), 'uploads', nombre));
    } catch {
      // Si el archivo ya no existe, no hay nada que limpiar.
    }
  });
});
