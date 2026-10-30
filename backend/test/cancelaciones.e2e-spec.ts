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

describe('Cancelación y salida de una clase (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let tokenA = '';
  let tokenB = '';
  let tokenAgenteA = '';

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
    tokenA = await iniciarSesion(app, semilla.correos.docenteA);
    tokenB = await iniciarSesion(app, semilla.correos.docenteB);
    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige un motivo para salir de la clase', async () => {
    const proyecto = await crearProyectoDePrueba(prisma, semilla);
    await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/salir`)
      .set(autenticado(tokenA))
      .send({ motivo: '' })
      .expect(400);
  });

  it('al salir con dos instituciones cancela la clase y las sesiones futuras', async () => {
    const proyecto = await crearProyectoDePrueba(prisma, semilla, {
      conSesion: true,
    });

    await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/salir`)
      .set(autenticado(tokenA))
      .send({ motivo: 'La institución ya no puede continuar' })
      .expect(201);

    const enBase = await prisma.proyectoClaseEspejo.findUniqueOrThrow({
      where: { id: proyecto.proyectoId },
    });
    expect(enBase.estado).toBe('CANCELADO');
    expect(enBase.motivoCancelacion).toContain('menos de dos');

    const participanteA = await prisma.proyectoParticipante.findFirstOrThrow({
      where: {
        proyectoId: proyecto.proyectoId,
        institucionId: semilla.institucionAId,
      },
    });
    expect(participanteA.estado).toBe('RETIRADA');

    const sesion = await prisma.sesion.findFirstOrThrow({
      where: { proyectoId: proyecto.proyectoId },
    });
    expect(sesion.estado).toBe('CANCELADA');

    await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}`)
      .set(autenticado(tokenA))
      .expect(200);

    const pdf = await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}/acta-pdf`)
      .set(autenticado(tokenA))
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('cancela la clase cuando todas las instituciones votan a favor', async () => {
    const proyecto = await crearProyectoDePrueba(prisma, semilla);
    const solicitud = await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/cancelacion`)
      .set(autenticado(tokenA))
      .send({ motivo: 'Cierre anticipado acordado' })
      .expect(201);

    expect(solicitud.body.solicitud.estado).toBe('PENDIENTE');

    const voto = await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/cancelacion/votos`)
      .set(autenticado(tokenB))
      .send({ decision: 'APROBADA', motivo: 'De acuerdo' })
      .expect(201);

    expect(voto.body.estado).toBe('CANCELADO');
    expect(voto.body.solicitud.estado).toBe('APROBADA');
  });

  it('si una institución rechaza, la clase sigue abierta', async () => {
    const proyecto = await crearProyectoDePrueba(prisma, semilla);
    await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/cancelacion`)
      .set(autenticado(tokenA))
      .send({ motivo: 'Solicitud de prueba' })
      .expect(201);

    const voto = await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/cancelacion/votos`)
      .set(autenticado(tokenB))
      .send({ decision: 'RECHAZADA', motivo: 'Podemos continuar' })
      .expect(201);

    expect(voto.body.estado).toBe('EN_PLANIFICACION');
    expect(voto.body.solicitud.estado).toBe('RECHAZADA');
  });

  it('no genera informes mientras la clase sigue abierta', async () => {
    const proyecto = await crearProyectoDePrueba(prisma, semilla);
    await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}/acta-pdf`)
      .set(autenticado(tokenA))
      .expect(400);
    await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}/expediente-pdf`)
      .set(autenticado(tokenAgenteA))
      .expect(400);
  });

  it('separa el acta del docente y el expediente del agente', async () => {
    const proyecto = await crearProyectoDePrueba(prisma, semilla);
    await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/salir`)
      .set(autenticado(tokenA))
      .send({ motivo: 'Cierre para probar los informes' })
      .expect(201);

    const acta = await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}/acta-pdf`)
      .set(autenticado(tokenA))
      .expect(200);
    expect(acta.headers['content-disposition']).toContain(
      `acta-ejecutiva-${proyecto.proyectoId}.pdf`,
    );

    await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}/acta-pdf`)
      .set(autenticado(tokenAgenteA))
      .expect(403);

    const expediente = await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}/expediente-pdf`)
      .set(autenticado(tokenAgenteA))
      .expect(200);
    expect(expediente.headers['content-type']).toContain('application/pdf');

    await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}/expediente-pdf`)
      .set(autenticado(tokenA))
      .expect(403);
  });

  it('también habilita los informes con la clase finalizada', async () => {
    const proyecto = await crearProyectoDePrueba(prisma, semilla);
    await prisma.proyectoClaseEspejo.update({
      where: { id: proyecto.proyectoId },
      data: { estado: 'FINALIZADO' },
    });

    await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}/acta-pdf`)
      .set(autenticado(tokenA))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/proyectos/${proyecto.proyectoId}/expediente-pdf`)
      .set(autenticado(tokenAgenteA))
      .expect(200);
  });

  it('registra la salida y la cancelación en los eventos del proyecto', async () => {
    const proyecto = await crearProyectoDePrueba(prisma, semilla);
    await request(app.getHttpServer())
      .post(`/proyectos/${proyecto.proyectoId}/salir`)
      .set(autenticado(tokenA))
      .send({ motivo: 'Motivo verificable para el informe' })
      .expect(201);

    const eventos = await prisma.proyectoEvento.findMany({
      where: { proyectoId: proyecto.proyectoId },
      orderBy: { creadoEn: 'asc' },
    });
    expect(eventos.some((evento) => evento.tipo === 'SALIDA')).toBe(true);
    expect(eventos.some((evento) => evento.tipo === 'CANCELACION')).toBe(true);
    expect(
      eventos.some((evento) => evento.motivo.includes('Motivo verificable')),
    ).toBe(true);
  });
});
