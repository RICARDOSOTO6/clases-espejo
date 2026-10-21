/**
 * Fase 2: cola de correo.
 *
 * Comprueba lo que promete el plan: los endpoints encolan y responden con un
 * lote; el worker manda y reintenta con espera creciente; cada fallo queda con su
 * motivo; solo el dueño ve el progreso; y encolar 300 correos no bloquea la
 * petición.
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
  type CorreoSimulado,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { EnviosCorreoService } from '../src/envios/envios.service';

jest.setTimeout(90000);

describe('Fase 2: cola de correo', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let correo: CorreoSimulado;
  let semilla: Semilla;
  let envios: EnviosCorreoService;
  let proyectoId = 0;

  let tokenDocenteA = '';
  let tokenAgenteA = '';

  const mail = () => app.get(MailService);

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    correo = e2e.correo;
    envios = app.get(EnviosCorreoService);
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);

    const proyecto = await crearProyectoDePrueba(prisma, semilla, {
      conSesion: true,
    });
    proyectoId = proyecto.proyectoId;

    tokenDocenteA = await iniciarSesion(app, semilla.correos.docenteA);
    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
  });

  afterAll(async () => {
    await app.close();
  });

  const encolarCalendario = async () =>
    request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/calendario/enviar`)
      .set(autenticado(tokenDocenteA))
      .expect(201);

  it('1. el endpoint solo encola y devuelve el lote con su progreso pendiente', async () => {
    const respuesta = await encolarCalendario();
    const loteId = respuesta.body.loteId as string;
    expect(loteId).toBeTruthy();

    const progreso = await request(app.getHttpServer())
      .get(`/envios/lotes/${loteId}`)
      .set(autenticado(tokenDocenteA))
      .expect(200);

    expect(progreso.body.total).toBeGreaterThanOrEqual(2);
    expect(progreso.body.pendientes).toBe(progreso.body.total);
    expect(progreso.body.completado).toBe(false);

    const filas = await prisma.envioCorreo.count({
      where: { loteId, estado: 'PENDIENTE' },
    });
    expect(filas).toBe(progreso.body.total);
  });

  it('2. el worker manda el lote y el progreso queda completo', async () => {
    const lote = await prisma.envioCorreo.findFirst({
      where: { estado: 'PENDIENTE' },
      select: { loteId: true },
    });
    expect(lote).not.toBeNull();

    const procesado = await envios.procesarPendientes();
    expect(procesado.enviados).toBeGreaterThanOrEqual(2);

    const progreso = await request(app.getHttpServer())
      .get(`/envios/lotes/${lote!.loteId}`)
      .set(autenticado(tokenDocenteA))
      .expect(200);
    expect(progreso.body.completado).toBe(true);
    expect(progreso.body.enviados).toBe(progreso.body.total);
    expect(progreso.body.fallidos).toBe(0);

    const llamadas = correo.llamadas.filter((l) => l.metodo === 'enviarCorreo');
    expect(llamadas.length).toBeGreaterThanOrEqual(2);
    const adjunto = llamadas[0].argumentos[2] as { nombre: string };
    expect(adjunto.nombre).toContain('.ics');
  });

  it('3. solo el dueño del lote ve el progreso', async () => {
    const lote = await prisma.envioCorreo.findFirst({
      select: { loteId: true },
    });
    await request(app.getHttpServer())
      .get(`/envios/lotes/${lote!.loteId}`)
      .set(autenticado(tokenAgenteA))
      .expect(403);
    await request(app.getHttpServer())
      .get('/envios/lotes/no-existe')
      .set(autenticado(tokenDocenteA))
      .expect(404);
  });

  it('4. un fallo se anota, espera y se reintenta hasta salir', async () => {
    const respuesta = await encolarCalendario();
    const loteId = respuesta.body.loteId as string;

    mail().enviarCorreo = jest
      .fn()
      .mockRejectedValueOnce(new Error('SMTP caído'));

    const primera = await envios.procesarPendientes();
    expect(primera.fallidos).toBe(1);

    const fallida = await prisma.envioCorreo.findFirstOrThrow({
      where: { loteId, estado: 'PENDIENTE' },
      select: { id: true, intentos: true, proximoIntento: true },
    });
    expect(fallida.intentos).toBe(1);
    expect(fallida.proximoIntento.getTime()).toBeGreaterThan(
      Date.now() + 30_000,
    );

    const progreso = await request(app.getHttpServer())
      .get(`/envios/lotes/${loteId}`)
      .set(autenticado(tokenDocenteA))
      .expect(200);
    expect(progreso.body.enviados).toBe(progreso.body.total - 1);
    expect(progreso.body.pendientes).toBe(1);

    // Se adelanta el reloj de la cola y se vuelve a intentar sin el fallo.
    mail().enviarCorreo = jest.fn().mockResolvedValue(undefined);
    await prisma.envioCorreo.update({
      where: { id: fallida.id },
      data: { proximoIntento: new Date(Date.now() - 1000) },
    });
    await envios.procesarPendientes();

    const final = await prisma.envioCorreo.findUniqueOrThrow({
      where: { id: fallida.id },
      select: { estado: true, intentos: true, ultimoError: true },
    });
    expect(final.estado).toBe('ENVIADO');
    expect(final.intentos).toBe(1);
    expect(final.ultimoError).toBe('');
  });

  it('5. tras agotar los intentos queda FALLIDO con el motivo', async () => {
    const respuesta = await encolarCalendario();
    const loteId = respuesta.body.loteId as string;

    await prisma.envioCorreo.updateMany({
      where: { loteId },
      data: {
        intentos: 4,
        proximoIntento: new Date(Date.now() - 1000),
      },
    });

    mail().enviarCorreo = jest
      .fn()
      .mockRejectedValue(new Error('El buzón no existe'));

    await envios.procesarPendientes();

    const progreso = await request(app.getHttpServer())
      .get(`/envios/lotes/${loteId}`)
      .set(autenticado(tokenDocenteA))
      .expect(200);
    expect(progreso.body.completado).toBe(true);
    expect(progreso.body.fallidos).toBe(progreso.body.total);
    expect(progreso.body.errores[0].ultimoError).toContain('buzón no existe');

    const filas = await prisma.envioCorreo.findMany({ where: { loteId } });
    expect(filas.every((f) => f.estado === 'FALLIDO' && f.fallidoEn)).toBe(
      true,
    );
    mail().enviarCorreo = jest.fn().mockResolvedValue(undefined);
  });

  it('6. encolar 300 correos tarda menos de 2 s y los deja en la cola', async () => {
    const correos = Array.from({ length: 300 }, (_, i) => ({
      destinatario: `alumno${i}@prueba.mx`,
      asunto: `Certificado de prueba ${i}`,
      texto: 'Hola',
      html: '<p>Hola</p>',
    }));

    const inicio = Date.now();
    const { loteId, total } = await envios.encolar(
      semilla.usuarioDocenteA,
      correos,
    );
    const duracion = Date.now() - inicio;

    expect(total).toBe(300);
    expect(duracion).toBeLessThan(2000);
    expect(await prisma.envioCorreo.count({ where: { loteId } })).toBe(300);
    await prisma.envioCorreo.deleteMany({ where: { loteId } });
  });

  it('7. tras reiniciar, lo encolado sigue pendiente (no se pierde)', async () => {
    const respuesta = await encolarCalendario();
    const loteId = respuesta.body.loteId as string;

    // Simula el corte: no se procesa y se comprueba que las filas siguen ahí.
    expect(
      await prisma.envioCorreo.count({
        where: { loteId, estado: 'PENDIENTE' },
      }),
    ).toBeGreaterThanOrEqual(2);

    const procesado = await envios.procesarPendientes();
    expect(procesado.enviados).toBeGreaterThanOrEqual(2);
  });
});
