/**
 * Integridad de negocio: las combinaciones que no deben repetirse.
 *
 * Se prueban tanto las rutas reales (materia y asignación) como la restricción
 * directa de `DOCENTE_INSTITUCION`, que no tiene un endpoint propio.
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

jest.setTimeout(60000);

describe('Integridad de datos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza una materia con la misma clave en la institución', async () => {
    const token = await iniciarSesion(app, semilla.correos.agenteA);
    const materia = {
      clave: 'DUP-101',
      nombre: 'Materia duplicada',
      programaEducativo: 'Programa de prueba',
      descripcion: 'Para comprobar la unicidad',
    };

    await request(app.getHttpServer())
      .post('/materias')
      .set(autenticado(token))
      .send(materia)
      .expect(201);

    const repetida = await request(app.getHttpServer())
      .post('/materias')
      .set(autenticado(token))
      .send(materia)
      .expect(409);
    expect(String(repetida.body.message)).toContain('Ya existe');

    await request(app.getHttpServer())
      .post('/materias')
      .set(autenticado(token))
      .send({ ...materia, clave: 'dup-101' })
      .expect(409);
  });

  it('rechaza una asignación repetida de docente, materia y periodo', async () => {
    const token = await iniciarSesion(app, semilla.correos.agenteA);
    const materia = await request(app.getHttpServer())
      .post('/materias')
      .set(autenticado(token))
      .send({
        clave: 'ASIG-101',
        nombre: 'Materia para asignación',
        programaEducativo: 'Programa de prueba',
        descripcion: 'Para comprobar la unicidad de la asignación',
      })
      .expect(201);

    const original = await prisma.asignacionDocente.findUniqueOrThrow({
      where: { id: semilla.asignacionAId },
      select: { docenteInstitucionId: true },
    });
    const dto = {
      docenteInstitucionId: original.docenteInstitucionId,
      materiaId: materia.body.id as number,
      periodoEscolar: '2026-1',
    };

    await request(app.getHttpServer())
      .post('/asignaciones')
      .set(autenticado(token))
      .send(dto)
      .expect(201);

    await request(app.getHttpServer())
      .post('/asignaciones')
      .set(autenticado(token))
      .send(dto)
      .expect(409);
  });

  it('la base rechaza dos vínculos del mismo docente e institución', async () => {
    const original = await prisma.docenteInstitucion.findFirstOrThrow({
      select: {
        docenteId: true,
        institucionId: true,
        numeroEmpleado: true,
      },
    });

    await expect(
      prisma.docenteInstitucion.create({
        data: {
          docenteId: original.docenteId,
          institucionId: original.institucionId,
          numeroEmpleado: `${original.numeroEmpleado}-DUP`,
          activo: true,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
