/**
 * Secretaría de institución: el agente principal crea un enlace sin correo, la
 * persona completa el cuestionario, queda activa y solo puede hacer las tareas
 * administrativas permitidas.
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

describe('Secretaría de institución (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let tokenAgente: string;
  let tokenSecretaria: string;
  let enlaceInvitacion: string;
  let nombreInstitucion: string;

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
    const institucion = await prisma.institucion.findUniqueOrThrow({
      where: { id: semilla.institucionAId },
      select: { nombre: true },
    });
    nombreInstitucion = institucion.nombre;
    tokenAgente = await iniciarSesion(app, semilla.correos.agenteA);
  });

  afterAll(async () => {
    await app.close();
  });

  it('el agente principal crea una invitación sin correo y devuelve el enlace', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/secretarias/invitacion')
      .set(autenticado(tokenAgente))
      .send({})
      .expect(201);

    expect(respuesta.body.enlace).toContain('/activar-secretaria?token=');
    expect(respuesta.body.correo).toBeUndefined();
    enlaceInvitacion = respuesta.body.enlace as string;
  });

  it('el token se valida y muestra la institución', async () => {
    const token = new URL(enlaceInvitacion).searchParams.get('token');
    const respuesta = await request(app.getHttpServer())
      .get('/auth/invitacion-secretaria')
      .query({ token })
      .expect(200);
    expect(respuesta.body.institucion.nombre).toBe(nombreInstitucion);
  });

  it('la persona activa la secretaría y queda con el rol correcto', async () => {
    const token = new URL(enlaceInvitacion).searchParams.get('token');
    await request(app.getHttpServer())
      .post('/auth/activar-secretaria')
      .send({
        token,
        nombres: 'Secretaria',
        apellidoPaterno: 'Prueba',
        apellidoMaterno: 'Institucional',
        tipoDocumento: 'DNI',
        dni: 'SECRE001',
        correo: 'secretaria.institucion@prueba.mx',
        password: 'PruebaSegura2026',
        aceptaAviso: true,
      })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        correo: 'secretaria.institucion@prueba.mx',
        password: 'PruebaSegura2026',
      })
      .expect(201);
    expect(login.body.usuario.rol).toBe('SECRETARIA_INSTITUCION');
    tokenSecretaria = login.body.access_token;
  });

  it('la secretaría ve su institución, docentes y resumen sin datos nominales', async () => {
    const institucion = await request(app.getHttpServer())
      .get('/secretarias/institucion')
      .set(autenticado(tokenSecretaria))
      .expect(200);
    expect(institucion.body.institucion.id).toBe(semilla.institucionAId);

    const docentes = await request(app.getHttpServer())
      .get('/secretarias/docentes')
      .set(autenticado(tokenSecretaria))
      .expect(200);
    expect(Array.isArray(docentes.body)).toBe(true);

    const resumen = await request(app.getHttpServer())
      .get('/secretarias/resumen')
      .set(autenticado(tokenSecretaria))
      .expect(200);
    expect(resumen.body).toEqual(
      expect.objectContaining({
        docentes: expect.any(Number),
        solicitudes: expect.any(Number),
        proyectos: expect.any(Number),
      }),
    );
    expect(resumen.body.alumnos).toBeUndefined();
  });

  it('la secretaría puede actualizar contacto pero no el nombre de la institución', async () => {
    const respuesta = await request(app.getHttpServer())
      .patch('/secretarias/institucion')
      .set(autenticado(tokenSecretaria))
      .send({ telefono: '+52 981 000 0000', ciudad: 'Campeche' })
      .expect(200);
    expect(respuesta.body.institucion.telefono).toBe('+52 981 000 0000');
    expect(respuesta.body.institucion.nombre).toBe(nombreInstitucion);
  });

  it('la secretaría puede invitar docentes y recibe un enlace copiable', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/secretarias/invitar-docente')
      .set(autenticado(tokenSecretaria))
      .send({ correo: 'docente.invitado@prueba.mx', numeroEmpleado: 'EMP-99' })
      .expect(201);
    expect(respuesta.body.enlace).toContain('/activate?token=');
    const fila = await prisma.invitacion.findFirst({
      where: { correo: 'docente.invitado@prueba.mx' },
    });
    expect(fila?.institucionId).toBe(semilla.institucionAId);
  });

  it('la secretaría puede subir y quitar el logo', async () => {
    const subida = await request(app.getHttpServer())
      .post('/instituciones/mia/logo')
      .set(autenticado(tokenSecretaria))
      .attach('logo', Buffer.from('PNG-DE-PRUEBA'), 'logo-secretaria.png')
      .expect(201);
    expect(subida.body.logoUrl).toContain('/logos/');

    await request(app.getHttpServer())
      .delete('/instituciones/mia/logo')
      .set(autenticado(tokenSecretaria))
      .expect(200);

    const perfil = await request(app.getHttpServer())
      .get('/secretarias/institucion')
      .set(autenticado(tokenSecretaria))
      .expect(200);
    expect(perfil.body.institucion.logoUrl).toBeNull();
  });

  it('no se puede tener una segunda secretaría activa', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/secretarias/invitacion')
      .set(autenticado(tokenAgente))
      .send({})
      .expect(409);
    expect(String(respuesta.body.message)).toContain('secretaría activa');
  });

  it('el agente principal consulta y desactiva la secretaría', async () => {
    const antes = await request(app.getHttpServer())
      .get('/secretarias/actual')
      .set(autenticado(tokenAgente))
      .expect(200);
    expect(antes.body.secretaria.activo).toBe(true);
    expect(antes.body.secretaria.nombre).toContain('Secretaria');

    await request(app.getHttpServer())
      .delete('/secretarias/actual')
      .set(autenticado(tokenAgente))
      .expect(200);

    const despues = await request(app.getHttpServer())
      .get('/secretarias/actual')
      .set(autenticado(tokenAgente))
      .expect(200);
    expect(despues.body.secretaria.activo).toBe(false);
  });

  it('después de desactivarla se puede generar un enlace nuevo', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/secretarias/invitacion')
      .set(autenticado(tokenAgente))
      .send({})
      .expect(201);
    expect(respuesta.body.enlace).toContain('/activar-secretaria?token=');
  });

  it('un agente no entra al panel de secretaría', async () => {
    await request(app.getHttpServer())
      .get('/secretarias/institucion')
      .set(autenticado(tokenAgente))
      .expect(403);
  });
});
