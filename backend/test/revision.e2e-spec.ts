/**
 * Flujo crítico 2: doble revisión de una solicitud de clase espejo.
 *
 * Lo que se vigila aquí:
 * - El destino **no se entera** de la solicitud hasta que el origen la aprueba
 *   (ni en el listado ni revisándola por identificador: 404).
 * - Cada etapa la revisa su institución; al aprobar el destino nace **un solo**
 *   proyecto con sus dos docentes (origen y destino) en estado EN_PLANIFICACION.
 * - Rechazar exige motivo; el docente puede corregir y la solicitud vuelve a
 *   PENDIENTE.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  autenticado,
  crearAppE2E,
  fechaFutura,
  iniciarSesion,
  limpiarBase,
  sembrarBase,
  type AppE2E,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('Flujo 2: doble revisión y creación del proyecto', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;

  let tokenDocenteA = '';
  let tokenAgenteA = '';
  let tokenAgenteB = '';
  let solicitudId = 0;

  const nuevaSolicitud = () => ({
    asignacionOrigenId: semilla.asignacionAId,
    institucionDestinoId: semilla.institucionBId,
    materiaDestinoId: semilla.materiaBId,
    titulo: 'Clase conjunta de prueba',
    objetivo: 'Coordinar una experiencia académica conjunta',
    fechaPropuesta: fechaFutura(20).toISOString(),
  });

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);

    tokenDocenteA = await iniciarSesion(app, semilla.correos.docenteA);
    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
    tokenAgenteB = await iniciarSesion(app, semilla.correos.agenteB);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. el docente crea la solicitud y nace PENDIENTE', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/solicitudes')
      .set(autenticado(tokenDocenteA))
      .send(nuevaSolicitud())
      .expect(201);

    expect(respuesta.body.estado).toBe('PENDIENTE');
    solicitudId = respuesta.body.id;
  });

  it('2. el destino no ve la solicitud hasta que el origen la apruebe', async () => {
    const entrantes = await request(app.getHttpServer())
      .get('/solicitudes/entrantes')
      .set(autenticado(tokenAgenteB))
      .expect(200);
    const ids = (entrantes.body as Array<{ id: number }>).map((s) => s.id);
    expect(ids).not.toContain(solicitudId);

    // Ni por identificador directo: para el destino todavía «no existe».
    await request(app.getHttpServer())
      .post(`/solicitudes/${solicitudId}/revisar`)
      .set(autenticado(tokenAgenteB))
      .send({ decision: 'APROBADA' })
      .expect(404);
  });

  it('3. el agente de origen aprueba y queda APROBADA_POR_ORIGEN', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/solicitudes/${solicitudId}/revisar`)
      .set(autenticado(tokenAgenteA))
      .send({ decision: 'APROBADA' })
      .expect(201);
    expect(respuesta.body.estado).toBe('APROBADA_POR_ORIGEN');

    // Ahora sí aparece en la bandeja del destino.
    const entrantes = await request(app.getHttpServer())
      .get('/solicitudes/entrantes')
      .set(autenticado(tokenAgenteB))
      .expect(200);
    const ids = (entrantes.body as Array<{ id: number }>).map((s) => s.id);
    expect(ids).toContain(solicitudId);
  });

  it('4. el destino aprueba eligiendo su docente y se crea el proyecto', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/solicitudes/${solicitudId}/revisar`)
      .set(autenticado(tokenAgenteB))
      .send({
        decision: 'APROBADA',
        asignacionDestinoId: semilla.asignacionBId,
      })
      .expect(201);
    expect(respuesta.body.estado).toBe('APROBADA');

    const proyectos = await prisma.proyectoClaseEspejo.findMany({
      where: { solicitudId },
      include: { docentes: true },
    });
    expect(proyectos).toHaveLength(1);
    expect(proyectos[0].estado).toBe('EN_PLANIFICACION');
    expect(proyectos[0].docentes).toHaveLength(2);
    expect(proyectos[0].docentes.map((d) => d.rol).sort()).toEqual([
      'DESTINO',
      'ORIGEN',
    ]);
  });

  it('5. el docente ve la clase en «mis proyectos»', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/proyectos/mios')
      .set(autenticado(tokenDocenteA))
      .expect(200);
    const ids = (respuesta.body as Array<{ id: number }>).map((p) => p.id);
    const proyecto = await prisma.proyectoClaseEspejo.findFirst({
      where: { solicitudId },
    });
    expect(ids).toContain(proyecto?.id);
  });

  it('6. aprobar de nuevo no duplica el proyecto', async () => {
    const proyecto = await prisma.proyectoClaseEspejo.findFirst({
      where: { solicitudId },
    });

    // La solicitud ya está APROBADA: el servicio no debe crear otra clase.
    await request(app.getHttpServer())
      .post(`/solicitudes/${solicitudId}/revisar`)
      .set(autenticado(tokenAgenteB))
      .send({
        decision: 'APROBADA',
        asignacionDestinoId: semilla.asignacionBId,
      });

    const cuantos = await prisma.proyectoClaseEspejo.count({
      where: { solicitudId },
    });
    expect(cuantos).toBe(1);
    expect(proyecto).toBeTruthy();
  });

  it('7. rechazar sin motivo se rechaza (400)', async () => {
    const creada = await request(app.getHttpServer())
      .post('/solicitudes')
      .set(autenticado(tokenDocenteA))
      .send(nuevaSolicitud())
      .expect(201);

    await request(app.getHttpServer())
      .post(`/solicitudes/${creada.body.id}/revisar`)
      .set(autenticado(tokenAgenteA))
      .send({ decision: 'RECHAZADA' })
      .expect(400);
  });

  it('8. rechazar con motivo deja la solicitud RECHAZADA', async () => {
    const creada = await request(app.getHttpServer())
      .post('/solicitudes')
      .set(autenticado(tokenDocenteA))
      .send(nuevaSolicitud())
      .expect(201);

    const respuesta = await request(app.getHttpServer())
      .post(`/solicitudes/${creada.body.id}/revisar`)
      .set(autenticado(tokenAgenteA))
      .send({ decision: 'RECHAZADA', comentario: 'Faltan datos del objetivo' })
      .expect(201);

    expect(respuesta.body.estado).toBe('RECHAZADA');
  });

  it('9. el docente corrige la solicitud rechazada y vuelve a PENDIENTE', async () => {
    const rechazada = await prisma.solicitudClaseEspejo.findFirst({
      where: { estado: 'RECHAZADA' },
      orderBy: { id: 'desc' },
    });
    expect(rechazada).toBeTruthy();

    const respuesta = await request(app.getHttpServer())
      .patch(`/solicitudes/${rechazada?.id}`)
      .set(autenticado(tokenDocenteA))
      .send({
        titulo: 'Clase conjunta corregida',
        fechaPropuesta: fechaFutura(25).toISOString(),
      })
      .expect(200);

    expect(respuesta.body.estado).toBe('PENDIENTE');
  });

  it('10. una cuenta que no es agente no puede revisar (401)', async () => {
    // La secretaría no es agente de ninguna de las dos instituciones.
    const tokenSecretaria = await iniciarSesion(
      app,
      semilla.correos.secretaria,
    );
    await request(app.getHttpServer())
      .post(`/solicitudes/${solicitudId}/revisar`)
      .set(autenticado(tokenSecretaria))
      .send({ decision: 'APROBADA' })
      .expect(401);
  });
});
