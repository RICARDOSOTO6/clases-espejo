/**
 * Baja con historial: una institución que ya participó en una clase no se
 * borra; queda ARCHIVADA, inoperable y con todo su historial. Reactivarla
 * limpia la baja.
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
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('Archivo de instituciones con historial (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let tokenPresidencia: string;
  let proyectoId: number;

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
    const proyecto = await crearProyectoDePrueba(prisma, semilla);
    proyectoId = proyecto.proyectoId;
    tokenPresidencia = await iniciarSesion(app, semilla.correos.presidencia);
  });

  afterAll(async () => {
    await app.close();
  });

  it('archiva la institución rechazada en vez de borrar su historial', async () => {
    await request(app.getHttpServer())
      .post(`/cace/instituciones/${semilla.institucionAId}/rechazar`)
      .set(autenticado(tokenPresidencia))
      .send({ motivo: 'Baja solicitada por la institución' })
      .expect(201);

    const respuesta = await request(app.getHttpServer())
      .delete(`/cace/instituciones/${semilla.institucionAId}`)
      .set(autenticado(tokenPresidencia))
      .expect(200);

    expect(respuesta.body.archivada).toBe(true);
    expect(String(respuesta.body.mensaje)).toContain('archivada');

    const institucion = await prisma.institucion.findUniqueOrThrow({
      where: { id: semilla.institucionAId },
      select: {
        estadoCace: true,
        activa: true,
        archivadaEn: true,
        archivadaPorUsuarioId: true,
        motivoArchivo: true,
      },
    });
    expect(institucion.estadoCace).toBe('ARCHIVADA');
    expect(institucion.activa).toBe(false);
    expect(institucion.archivadaEn).toBeInstanceOf(Date);
    expect(institucion.archivadaPorUsuarioId).toBe(semilla.usuarioPresidencia);
    expect(institucion.motivoArchivo).toContain('clase');

    // La clase espejo y su historial siguen existiendo.
    expect(
      await prisma.proyectoClaseEspejo.count({ where: { id: proyectoId } }),
    ).toBe(1);
  });

  it('la institución archivada no vuelve a operar hasta reactivarla', async () => {
    const listado = await request(app.getHttpServer())
      .get('/cace/instituciones')
      .set(autenticado(tokenPresidencia))
      .expect(200);
    const fila = (
      listado.body as Array<{ id: number; estadoCace: string }>
    ).find((institucion) => institucion.id === semilla.institucionAId);
    expect(fila?.estadoCace).toBe('ARCHIVADA');

    const reactivada = await request(app.getHttpServer())
      .post(`/cace/instituciones/${semilla.institucionAId}/reactivar`)
      .set(autenticado(tokenPresidencia))
      .expect(201);
    expect(reactivada.body.estadoCace).toBe('APROBADA');

    const institucion = await prisma.institucion.findUniqueOrThrow({
      where: { id: semilla.institucionAId },
      select: {
        estadoCace: true,
        activa: true,
        archivadaEn: true,
        archivadaPorUsuarioId: true,
        motivoArchivo: true,
      },
    });
    expect(institucion.estadoCace).toBe('APROBADA');
    expect(institucion.activa).toBe(true);
    expect(institucion.archivadaEn).toBeNull();
    expect(institucion.archivadaPorUsuarioId).toBeNull();
    expect(institucion.motivoArchivo).toBe('');
  });
});
