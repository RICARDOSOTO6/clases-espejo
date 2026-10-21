/**
 * Flujo crítico 6: entrega del calendario de la clase (`.ics`).
 *
 * - El docente participante descarga el archivo y lo manda por correo; el
 *   archivo lleva dentro sus tres avisos (1 hora, 30 y 15 minutos).
 * - El agente lo puede **consultar** (descargar), pero el envío por correo es
 *   de los docentes participantes; la secretaría no llega a ninguno de los dos.
 * - El envío se hace con el correo simulado, así que la prueba comprueba el
 *   informe de envíos sin mandar correos de verdad.
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
import { EnviosCorreoService } from '../src/envios/envios.service';

jest.setTimeout(60000);

describe('Flujo 6: calendario de la clase', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let correo: CorreoSimulado;
  let semilla: Semilla;
  let envios: EnviosCorreoService;
  let proyectoId = 0;

  let tokenDocenteA = '';
  let tokenDocenteB = '';
  let tokenAgenteA = '';
  let tokenSecretaria = '';

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
    tokenDocenteB = await iniciarSesion(app, semilla.correos.docenteB);
    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
    tokenSecretaria = await iniciarSesion(app, semilla.correos.secretaria);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. el docente participante descarga el .ics con sus avisos', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/calendario.ics`)
      .set(autenticado(tokenDocenteA))
      .expect(200);

    expect(String(respuesta.headers['content-type'])).toContain(
      'text/calendar',
    );
    const ics = respuesta.text;
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:sesion-');
    // Los tres avisos pedidos (1 hora, 30 y 15 minutos) van dentro del evento.
    const avisos = (ics.match(/BEGIN:VALARM/g) ?? []).length;
    expect(avisos).toBeGreaterThanOrEqual(3);
  });

  it('2. el docente del otro lado también lo puede descargar', async () => {
    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/calendario.ics`)
      .set(autenticado(tokenDocenteB))
      .expect(200);
  });

  it('3. el agente de la institución puede consultarlo, pero no enviarlo', async () => {
    // El agente participa en la clase como consulta: puede descargar el archivo…
    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/calendario.ics`)
      .set(autenticado(tokenAgenteA))
      .expect(200);

    // …pero el envío por correo es de los docentes participantes.
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/calendario/enviar`)
      .set(autenticado(tokenAgenteA))
      .expect(403);
  });

  it('4. la secretaría de la CACE tampoco (403)', async () => {
    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/calendario.ics`)
      .set(autenticado(tokenSecretaria))
      .expect(403);
  });

  it('5. el envío por correo encola el lote y el worker lo manda', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/calendario/enviar`)
      .set(autenticado(tokenDocenteA))
      .expect(201);

    expect(respuesta.body.total).toBeGreaterThanOrEqual(1);
    expect(respuesta.body.loteId).toBeTruthy();
    expect(respuesta.body.encolados).toBeGreaterThanOrEqual(1);
    expect(respuesta.body.nombreArchivo).toContain('.ics');
    // Todavía no salió nada: el endpoint solo encola.
    expect(respuesta.body.enviados).toHaveLength(0);

    const procesado = await envios.procesarPendientes();
    expect(procesado.enviados).toBeGreaterThanOrEqual(1);

    const progreso = await request(app.getHttpServer())
      .get(`/envios/lotes/${respuesta.body.loteId as string}`)
      .set(autenticado(tokenDocenteA))
      .expect(200);
    expect(progreso.body.completado).toBe(true);
    expect(progreso.body.enviados).toBeGreaterThanOrEqual(1);
    expect(progreso.body.fallidos).toBe(0);

    const enviosCorreo = correo.llamadas.filter(
      (l) => l.metodo === 'enviarCorreo',
    );
    expect(enviosCorreo.length).toBeGreaterThanOrEqual(1);
    const contenido = enviosCorreo[0].argumentos[1] as { asunto: string };
    expect(contenido.asunto).toContain('Calendario');
  });

  it('6. el .ics incluye la sesión programada con su enlace', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/calendario.ics`)
      .set(autenticado(tokenDocenteA))
      .expect(200);

    expect(respuesta.text).toContain('meet.example.com');
  });
});
