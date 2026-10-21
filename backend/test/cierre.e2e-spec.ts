/**
 * Flujo crítico 5: cierre de la clase espejo.
 *
 * El cierre no se puede fijar a mano: solo lo asigna la acción «Cerrar clase
 * espejo», y exige (1) al menos una evaluación final y (2) el reporte de cada
 * sesión **confirmado por todos los docentes**. Aquí se recorre el camino
 * completo, comprobando cada negativa con su motivo.
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

describe('Flujo 5: cierre de la clase espejo', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let proyectoId = 0;
  let sesionId = 0;
  let reporteId = 0;

  let tokenDocenteA = '';
  let tokenDocenteB = '';
  let tokenAgenteA = '';

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);

    const proyecto = await crearProyectoDePrueba(prisma, semilla, {
      conSesion: true,
    });
    proyectoId = proyecto.proyectoId;
    sesionId = proyecto.sesionId ?? 0;

    tokenDocenteA = await iniciarSesion(app, semilla.correos.docenteA);
    tokenDocenteB = await iniciarSesion(app, semilla.correos.docenteB);
    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. sin evaluación final, el cierre se niega (400)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/cerrar`)
      .set(autenticado(tokenDocenteA))
      .expect(400);
    expect(String(respuesta.body.message)).toContain('evaluación final');
  });

  it('2. el docente registra la evaluación final', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/evaluaciones`)
      .set(autenticado(tokenDocenteA))
      .send({
        instrumento: 'Rúbrica de la clase espejo',
        resultado: 'Satisfactorio',
        observaciones: 'Los alumnos cumplieron los objetivos',
      })
      .expect(201);
  });

  it('3. sin el reporte de la sesión confirmado, el cierre sigue negado (400)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/cerrar`)
      .set(autenticado(tokenDocenteA))
      .expect(400);
    expect(String(respuesta.body.message)).toContain('reporte');
  });

  it('4. el docente guarda el reporte de clase de la sesión', async () => {
    const respuesta = await request(app.getHttpServer())
      .put(`/proyectos/${proyectoId}/sesiones/${sesionId}/reporte`)
      .set(autenticado(tokenDocenteA))
      .send({
        desarrolloClase: 'Se desarrolló el tema acordado sin incidencias.',
        totalAsistentes: 24,
        incidencias: 'Ninguna',
        acuerdosSiguienteSesion: 'Entregar la actividad final.',
      })
      .expect(200);

    reporteId = respuesta.body.id;
    expect(respuesta.body.estado).toBe('BORRADOR');
  });

  it('5. con el reporte en borrador, el cierre se niega (400)', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/cerrar`)
      .set(autenticado(tokenDocenteA))
      .expect(400);
  });

  it('6. la firma de un solo docente deja el reporte en EN_REVISION', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/reportes-clase/${reporteId}/confirmar`)
      .set(autenticado(tokenDocenteA))
      .send({ observaciones: 'De acuerdo con lo registrado' })
      .expect(201);
    expect(respuesta.body.estado).toBe('EN_REVISION');
  });

  it('7. con una sola firma, el cierre todavía se niega (400)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/cerrar`)
      .set(autenticado(tokenDocenteA))
      .expect(400);
    expect(String(respuesta.body.message)).toContain('reporte');
  });

  it('8. la firma del segundo docente confirma el reporte', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/reportes-clase/${reporteId}/confirmar`)
      .set(autenticado(tokenDocenteB))
      .send({ observaciones: 'Conforme con el reporte' })
      .expect(201);
    expect(respuesta.body.estado).toBe('CONFIRMADO');
  });

  it('9. el agente no puede cerrar la clase (403)', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/cerrar`)
      .set(autenticado(tokenAgenteA))
      .expect(403);
  });

  it('10. con todo en regla, el docente cierra y queda FINALIZADO', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/cerrar`)
      .set(autenticado(tokenDocenteA))
      .expect(201);
    expect(respuesta.body.estado).toBe('FINALIZADO');

    const enBase = await prisma.proyectoClaseEspejo.findUnique({
      where: { id: proyectoId },
    });
    expect(enBase?.estado).toBe('FINALIZADO');
  });

  it('11. una clase ya finalizada no se vuelve a cerrar (400)', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/cerrar`)
      .set(autenticado(tokenDocenteA))
      .expect(400);
  });
});
