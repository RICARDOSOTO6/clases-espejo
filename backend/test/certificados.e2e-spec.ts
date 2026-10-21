/**
 * Flujo crítico 4: certificados (emisión, PDF, anulación, reemisión y
 * verificación pública con el código derivado por HMAC).
 *
 * La verificación se prueba del lado público (`/verificar/:folio?c=…`), sin
 * sesión, que es exactamente lo que abre el QR impreso.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  autenticado,
  crearAppE2E,
  crearPlantillaDePrueba,
  crearProyectoDePrueba,
  iniciarSesion,
  limpiarBase,
  sembrarBase,
  type AppE2E,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';
import { codigoVerificacion } from '../src/certificados/codigo-verificacion';

jest.setTimeout(90000);

describe('Flujo 4: certificados y verificación pública', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;

  let proyectoId = 0;
  let proyectoAbiertoId = 0;
  let alumnoId = 0;
  let otroAlumnoId = 0;
  let certificadoId = 0;
  let otroCertificadoId = 0;
  let folio = '';
  let otroFolio = '';

  let tokenDocenteA = '';
  let tokenDocenteB = '';
  let tokenAgenteA = '';

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);

    const cerrado = await crearProyectoDePrueba(prisma, semilla, {
      estado: 'FINALIZADO',
    });
    proyectoId = cerrado.proyectoId;
    const abierto = await crearProyectoDePrueba(prisma, semilla);
    proyectoAbiertoId = abierto.proyectoId;

    await crearPlantillaDePrueba(prisma, semilla.usuarioPresidencia);

    tokenDocenteA = await iniciarSesion(app, semilla.correos.docenteA);
    tokenDocenteB = await iniciarSesion(app, semilla.correos.docenteB);
    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. el docente sube la lista de SUS alumnos', async () => {
    const respuesta = await request(app.getHttpServer())
      .put(`/proyectos/${proyectoId}/listas-alumnos`)
      .set(autenticado(tokenDocenteA))
      .send({
        origen: 'PEGADO',
        alumnos: [
          {
            nombre: 'Alumno Uno de Prueba',
            matricula: 'A-001',
            correo: 'alumno.uno@prueba.mx',
          },
          {
            nombre: 'Alumno Dos de Prueba',
            matricula: 'A-002',
            correo: 'alumno.dos@prueba.mx',
          },
        ],
      })
      .expect(200);

    const alumnos = respuesta.body.alumnos as Array<{ id: number }>;
    expect(alumnos).toHaveLength(2);
    alumnoId = alumnos[0].id;
    otroAlumnoId = alumnos[1].id;
  });

  it('2. con la clase abierta no se puede emitir (400)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoAbiertoId}/certificados/emitir`)
      .set(autenticado(tokenDocenteA))
      .send({})
      .expect(400);
    expect(String(respuesta.body.message)).toContain('Todavía no se pueden');
  });

  it('3. el agente no puede emitir certificados (403)', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/certificados/emitir`)
      .set(autenticado(tokenAgenteA))
      .send({})
      .expect(403);
  });

  it('4. con la clase cerrada, el docente emite los certificados de su lista', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/certificados/emitir`)
      .set(autenticado(tokenDocenteA))
      .send({})
      .expect(201);

    const emitidos = respuesta.body.emitidos as Array<{
      id: number;
      folio: string;
    }>;
    expect(emitidos).toHaveLength(2);

    // El orden de `emitidos` no tiene por qué coincidir con el de la lista:
    // se busca en la base el certificado de cada alumno para no confundirlos.
    const enBase = await prisma.certificado.findMany({
      where: { proyectoId },
    });
    expect(enBase).toHaveLength(2);
    const propio = enBase.find((c) => c.alumnoId === alumnoId);
    const otro = enBase.find((c) => c.alumnoId === otroAlumnoId);
    expect(propio).toBeTruthy();
    expect(otro).toBeTruthy();
    certificadoId = propio?.id ?? 0;
    folio = propio?.folio ?? '';
    otroCertificadoId = otro?.id ?? 0;
    otroFolio = otro?.folio ?? '';
    expect(folio).toMatch(/^CACE-\d{4}-\d{4}$/);
    expect(otroFolio).not.toBe(folio);
  });

  it('5. el PDF del certificado se descarga con sesión', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/certificados/${certificadoId}/pdf`)
      .set(autenticado(tokenDocenteA))
      .expect(200);

    expect(String(respuesta.headers['content-type'])).toContain(
      'application/pdf',
    );
    expect(Number(respuesta.headers['content-length'] ?? 0)).toBeGreaterThan(
      1000,
    );
  });

  it('6. la página pública valida el certificado con su código HMAC', async () => {
    const codigo = codigoVerificacion(folio);
    const respuesta = await request(app.getHttpServer())
      .get(`/verificar/${folio}`)
      .query({ c: codigo })
      .expect(200);

    expect(respuesta.body.estado).toBe('VALIDO');
    expect(respuesta.body.certificado.alumno).toContain('Alumno Uno');
  });

  it('7. sin el código correcto la respuesta es INVALIDO', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/verificar/${folio}`)
      .query({ c: 'ABCDEFGH' })
      .expect(200);
    expect(respuesta.body.estado).toBe('INVALIDO');
    expect(respuesta.body.certificado).toBeNull();
  });

  it('8. un folio inexistente con código válido es NO_ENCONTRADO', async () => {
    const inventado = 'CACE-2026-9999';
    const respuesta = await request(app.getHttpServer())
      .get(`/verificar/${inventado}`)
      .query({ c: codigoVerificacion(inventado) })
      .expect(200);
    expect(respuesta.body.estado).toBe('NO_ENCONTRADO');
  });

  it('9. anular exige motivo (400)', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/certificados/${certificadoId}/anular`)
      .set(autenticado(tokenDocenteA))
      .send({ motivo: '' })
      .expect(400);
  });

  it('10. anular con motivo deja de ser válido en la página pública', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/certificados/${certificadoId}/anular`)
      .set(autenticado(tokenDocenteA))
      .send({ motivo: 'Datos del alumno incorrectos' })
      .expect(201);

    const respuesta = await request(app.getHttpServer())
      .get(`/verificar/${folio}`)
      .query({ c: codigoVerificacion(folio) })
      .expect(200);
    expect(respuesta.body.estado).toBe('ANULADO');
  });

  it('11. reemitir anula el anterior y emite uno nuevo', async () => {
    // Se reemite el certificado del OTRO alumno, que sigue EMITIDO: reemitir
    // parte de un certificado vigente y lo sustituye por uno nuevo.
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/certificados/emitir`)
      .set(autenticado(tokenDocenteA))
      .send({ alumnoId: otroAlumnoId, reemitir: true })
      .expect(201);

    const reemitidos = respuesta.body.reemitidos as Array<{
      folio: string;
    }>;
    expect(reemitidos).toHaveLength(1);
    expect(reemitidos[0].folio).not.toBe(otroFolio);

    const anterior = await request(app.getHttpServer())
      .get(`/verificar/${otroFolio}`)
      .query({ c: codigoVerificacion(otroFolio) })
      .expect(200);
    expect(anterior.body.estado).toBe('ANULADO');

    const verificado = await request(app.getHttpServer())
      .get(`/verificar/${reemitidos[0].folio}`)
      .query({ c: codigoVerificacion(reemitidos[0].folio) })
      .expect(200);
    expect(verificado.body.estado).toBe('VALIDO');

    // El id del certificado reemitido se conserva para el resto de la suite.
    expect(otroCertificadoId).toBeGreaterThan(0);
  });

  it('12. el docente del otro lado no emite para la lista ajena (400)', async () => {
    // La institución del docente B no ha subido lista para esta clase.
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/certificados/emitir`)
      .set(autenticado(tokenDocenteB))
      .send({})
      .expect(400);
  });
});
