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

describe('Panel de desempeño', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;

  let tokenPresidencia = '';
  let tokenAgenteA = '';
  let tokenDocenteA = '';
  let tokenSecretaria = '';

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);

    await crearProyectoDePrueba(prisma, semilla, { estado: 'FINALIZADO' });

    const fecha = new Date();
    await prisma.solicitudClaseEspejo.create({
      data: {
        asignacionOrigenId: semilla.asignacionAId,
        asignacionDestinoId: semilla.asignacionBId,
        institucionDestinoId: semilla.institucionBId,
        materiaDestinoId: semilla.materiaBId,
        titulo: 'Solicitud rechazada de prueba',
        objetivo: 'Comprobar el contador de rechazadas',
        fechaPropuesta: fecha,
        estado: 'RECHAZADA',
      },
    });
    await prisma.solicitudClaseEspejo.create({
      data: {
        asignacionOrigenId: semilla.asignacionAId,
        institucionDestinoId: semilla.institucionBId,
        titulo: 'Solicitud caducada de prueba',
        objetivo: 'Comprobar el contador de caducadas',
        fechaPropuesta: fecha,
        estado: 'CADUCADA',
      },
    });

    tokenPresidencia = await iniciarSesion(app, semilla.correos.presidencia);
    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
    tokenDocenteA = await iniciarSesion(app, semilla.correos.docenteA);
    tokenSecretaria = await iniciarSesion(app, semilla.correos.secretaria);
  });

  afterAll(async () => {
    await app.close();
  });

  it('la presidencia ve el desempeño por institución con clases y solicitudes', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/cace/desempeno')
      .set(autenticado(tokenPresidencia))
      .expect(200);

    expect(respuesta.body.instituciones).toHaveLength(2);
    const filaA = respuesta.body.instituciones.find(
      (i: { id: number }) => i.id === semilla.institucionAId,
    );
    expect(filaA.proyectos.finalizados).toBe(1);
    expect(filaA.solicitudes.rechazadas).toBe(1);
    expect(filaA.solicitudes.caducadas).toBe(1);
    expect(filaA.tasaCierre).toBe(100);
  });

  it('el agente solo ve el desempeño de sus docentes', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/agentes/desempeno')
      .set(autenticado(tokenAgenteA))
      .expect(200);

    expect(respuesta.body.docentes).toHaveLength(1);
    expect(respuesta.body.docentes[0].nombre).toContain('Docente');
    expect(respuesta.body.docentes[0].proyectos.finalizados).toBe(1);
    expect(respuesta.body.docentes[0].solicitudes.rechazadas).toBe(1);
  });

  it('la presidencia y la secretaría no acceden al panel del agente', async () => {
    await request(app.getHttpServer())
      .get('/agentes/desempeno')
      .set(autenticado(tokenPresidencia))
      .expect(403);
    await request(app.getHttpServer())
      .get('/agentes/desempeno')
      .set(autenticado(tokenSecretaria))
      .expect(403);
  });

  it('un docente y la secretaría CACE no ven el panel de instituciones', async () => {
    await request(app.getHttpServer())
      .get('/cace/desempeno')
      .set(autenticado(tokenDocenteA))
      .expect(403);
    await request(app.getHttpServer())
      .get('/cace/desempeno')
      .set(autenticado(tokenSecretaria))
      .expect(403);
  });

  it('sin token los dos paneles responden 401', async () => {
    await request(app.getHttpServer()).get('/cace/desempeno').expect(401);
    await request(app.getHttpServer()).get('/agentes/desempeno').expect(401);
  });
});
