/**
 * Reenvío de invitaciones de docente (Fase 1).
 *
 * Lo que se vigila:
 * - El agente ve las invitaciones pendientes de su institución, **también las
 *   caducadas** (son las que hay que reenviar).
 * - Reenviar genera un token **nuevo**: el enlace anterior deja de valer.
 * - Solo el agente de la institución dueña puede reenviarla.
 * - Una invitación ya usada no se reenvía.
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
  type CorreoSimulado,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(90000);

describe('Fase 1: reenvío de invitaciones', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let correo: CorreoSimulado;
  let semilla: Semilla;

  let tokenAgenteA = '';
  let tokenAgenteB = '';
  let invitacionId = 0;
  let tokenOriginal = '';

  const correoDocente = 'reenvio.docente@prueba.mx';

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    correo = e2e.correo;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);

    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
    tokenAgenteB = await iniciarSesion(app, semilla.correos.agenteB);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. el agente invita y la invitación aparece como pendiente', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/agentes/invitar-docente')
      .set(autenticado(tokenAgenteA))
      .send({ correo: correoDocente, numeroEmpleado: 'DOC-R-001' })
      .expect(201);
    expect(respuesta.body.enlace).toContain('/activate?token=');
    expect(respuesta.body.correoEnviado).toBe(true);

    const lista = await request(app.getHttpServer())
      .get('/agentes/invitaciones')
      .set(autenticado(tokenAgenteA))
      .expect(200);

    const pendientes = lista.body as Array<{
      id: number;
      correo: string;
      caducada: boolean;
    }>;
    const invitacion = pendientes.find((i) => i.correo === correoDocente);
    expect(invitacion).toBeTruthy();
    expect(invitacion?.caducada).toBe(false);
    invitacionId = invitacion?.id ?? 0;

    const enBase = await prisma.invitacion.findUnique({
      where: { id: invitacionId },
    });
    tokenOriginal = enBase?.token ?? '';
    expect(tokenOriginal.length).toBeGreaterThan(10);
  });

  it('2. reenviar cambia el token y el enlace anterior deja de valer', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/agentes/invitaciones/${invitacionId}/reenviar`)
      .set(autenticado(tokenAgenteA))
      .expect(201);
    expect(respuesta.body.mensaje).toContain('reenviada');
    expect(respuesta.body.enlace).toContain('/activate?token=');

    const enBase = await prisma.invitacion.findUnique({
      where: { id: invitacionId },
    });
    expect(enBase?.token).not.toBe(tokenOriginal);

    // El enlace viejo ya no existe para el servidor.
    await request(app.getHttpServer())
      .get('/auth/activate')
      .query({ token: tokenOriginal })
      .expect(404);
    // El nuevo sí.
    await request(app.getHttpServer())
      .get('/auth/activate')
      .query({ token: enBase?.token })
      .expect(200);

    const envios = correo.llamadas.filter((l) => l.metodo === 'sendInvitation');
    expect(envios.length).toBeGreaterThanOrEqual(2);
  });

  it('3. otro agente no puede reenviar una invitación ajena (404)', async () => {
    await request(app.getHttpServer())
      .post(`/agentes/invitaciones/${invitacionId}/reenviar`)
      .set(autenticado(tokenAgenteB))
      .expect(404);
  });

  it('4. una invitación ya usada no se reenvía (400)', async () => {
    await prisma.invitacion.update({
      where: { id: invitacionId },
      data: { usadaEn: new Date() },
    });

    await request(app.getHttpServer())
      .post(`/agentes/invitaciones/${invitacionId}/reenviar`)
      .set(autenticado(tokenAgenteA))
      .expect(400);
  });

  it('5. una invitación caducada se puede reenviar y vuelve a estar vigente', async () => {
    const caducada = await prisma.invitacion.create({
      data: {
        correo: 'caducado@prueba.mx',
        numeroEmpleado: 'DOC-R-002',
        institucionId: semilla.institucionAId,
        token: 'token-caducado-de-prueba',
        expiracion: new Date(Date.now() - 60_000),
      },
    });

    const antes = await request(app.getHttpServer())
      .get('/agentes/invitaciones')
      .set(autenticado(tokenAgenteA))
      .expect(200);
    const filaAntes = (
      antes.body as Array<{ id: number; caducada: boolean }>
    ).find((i) => i.id === caducada.id);
    expect(filaAntes?.caducada).toBe(true);

    await request(app.getHttpServer())
      .post(`/agentes/invitaciones/${caducada.id}/reenviar`)
      .set(autenticado(tokenAgenteA))
      .expect(201);

    const despues = await request(app.getHttpServer())
      .get('/agentes/invitaciones')
      .set(autenticado(tokenAgenteA))
      .expect(200);
    const filaDespues = (
      despues.body as Array<{ id: number; caducada: boolean }>
    ).find((i) => i.id === caducada.id);
    expect(filaDespues?.caducada).toBe(false);
  });

  it('6. la lista no mezcla invitaciones de otras instituciones', async () => {
    await prisma.invitacion.create({
      data: {
        correo: 'ajena@prueba.mx',
        numeroEmpleado: 'DOC-B-999',
        institucionId: semilla.institucionBId,
        token: 'token-de-otra-institucion',
        expiracion: new Date(Date.now() + 3_600_000),
      },
    });

    const lista = await request(app.getHttpServer())
      .get('/agentes/invitaciones')
      .set(autenticado(tokenAgenteA))
      .expect(200);
    const correos = (lista.body as Array<{ correo: string }>).map(
      (i) => i.correo,
    );
    expect(correos).not.toContain('ajena@prueba.mx');
  });
});
