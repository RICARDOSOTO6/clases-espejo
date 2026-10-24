/**
 * Plazos configurables: la presidencia fija los días mínimos para proponer y
 * los días de revisión, y el alta de solicitudes los respeta.
 */
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

jest.setTimeout(90000);

function fechaEnDias(dias: number): string {
  const hoy = new Date();
  const fecha = new Date(
    Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias),
  );
  return fecha.toISOString().slice(0, 10);
}

describe('Plazos configurables (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let tokenPresidencia: string;

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
    tokenPresidencia = await iniciarSesion(app, semilla.correos.presidencia);
  });

  afterAll(async () => {
    await app.close();
  });

  it('la presidencia cambia los dos plazos y la API los devuelve', async () => {
    const respuesta = await request(app.getHttpServer())
      .patch('/cace/configuracion')
      .set(autenticado(tokenPresidencia))
      .send({ diasMinimosPropuesta: 10, diasRevision: 5 })
      .expect(200);

    expect(respuesta.body.diasMinimosPropuesta).toBe(10);
    expect(respuesta.body.diasRevision).toBe(5);

    const config = await request(app.getHttpServer())
      .get('/cace/configuracion')
      .set(autenticado(tokenPresidencia))
      .expect(200);
    expect(config.body.diasMinimosPropuesta).toBe(10);
    expect(config.body.diasRevision).toBe(5);
  });

  it('una propuesta con 9 días se rechaza y con 10 se acepta', async () => {
    const tokenDocente = await iniciarSesion(app, semilla.correos.docenteA);
    const base = {
      asignacionOrigenId: semilla.asignacionAId,
      institucionDestinoId: semilla.institucionBId,
      materiaDestinoId: semilla.materiaBId,
      titulo: 'Clase con plazo configurado',
      objetivo: 'Comprobar que se respetan los días mínimos',
    };

    const corta = await request(app.getHttpServer())
      .post('/solicitudes')
      .set(autenticado(tokenDocente))
      .send({ ...base, fechaPropuesta: fechaEnDias(9) })
      .expect(400);
    expect(String(corta.body.message)).toContain('10 días');

    await request(app.getHttpServer())
      .post('/solicitudes')
      .set(autenticado(tokenDocente))
      .send({ ...base, fechaPropuesta: fechaEnDias(10) })
      .expect(201);
  });

  it('la agenda devuelve el plazo de revisión configurado', async () => {
    const tokenDocente = await iniciarSesion(app, semilla.correos.docenteA);
    const agenda = await request(app.getHttpServer())
      .get('/recordatorios')
      .set(autenticado(tokenDocente))
      .expect(200);
    expect(agenda.body.configuracion.diasAntelacionRevision).toBe(5);
    expect(agenda.body.configuracion.diasMinimosPropuesta).toBe(10);
  });

  it('vuelve a 8 y 7 para no contaminar otras pruebas', async () => {
    const respuesta = await request(app.getHttpServer())
      .patch('/cace/configuracion')
      .set(autenticado(tokenPresidencia))
      .send({ diasMinimosPropuesta: 8, diasRevision: 7 })
      .expect(200);
    expect(respuesta.body.diasMinimosPropuesta).toBe(8);
    expect(respuesta.body.diasRevision).toBe(7);
  });
});
