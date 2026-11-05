import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AppE2E,
  PASSWORD_PRUEBA,
  autenticado,
  crearAppE2E,
  iniciarSesion,
  limpiarBase,
  sembrarBase,
  Semilla,
} from './base-e2e';

/**
 * Una misma cuenta puede ser agente y docente.
 *
 * La prueba comprueba los dos papeles: antes de activar el perfil docente el
 * usuario solo puede entrar como agente; después de activarlo la misma fila de
 * USUARIO recibe el vínculo DOCENTE y conserva el de agente.
 */
describe('Perfil docente de un agente (e2e)', () => {
  let app: INestApplication;
  let prisma: AppE2E['prisma'];
  let semilla: Semilla;

  beforeAll(async () => {
    const creada = await crearAppE2E();
    app = creada.app;
    prisma = creada.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('activa el perfil docente sin crear otro usuario', async () => {
    const token = await iniciarSesion(app, semilla.correos.agenteA);
    const antes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: semilla.correos.agenteA, password: PASSWORD_PRUEBA })
      .expect(201);

    expect(antes.body.usuario.rol).toBe('AGENTE');
    expect(antes.body.usuario.roles).toEqual(['AGENTE']);
    expect(antes.body.usuario.tieneDocente).toBe(false);

    const usuariosAntes = await prisma.usuario.count({
      where: { correo: semilla.correos.agenteA },
    });

    const activado = await request(app.getHttpServer())
      .post('/agentes/mi-perfil-docente')
      .set(autenticado(token))
      .send({
        gradoAcademico: 'Maestría',
        especialidad: 'Internacionalización educativa',
        numeroEmpleado: 'EMP-AGENTE-001',
        materiaId: semilla.materiaAId,
        periodoEscolar: '2026-2',
      })
      .expect(201);

    expect(activado.body.roles).toEqual(['AGENTE', 'DOCENTE']);
    expect(activado.body.tieneDocente).toBe(true);

    const usuariosDespues = await prisma.usuario.count({
      where: { correo: semilla.correos.agenteA },
    });
    expect(usuariosDespues).toBe(usuariosAntes);

    const docente = await prisma.docente.findUnique({
      where: { usuarioId: semilla.usuarioAgenteA },
      include: { instituciones: { include: { asignaciones: true } } },
    });
    expect(docente).not.toBeNull();
    expect(docente?.instituciones).toHaveLength(1);
    expect(docente?.instituciones[0].asignaciones).toHaveLength(1);

    const despues = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: semilla.correos.agenteA, password: PASSWORD_PRUEBA })
      .expect(201);
    expect(despues.body.usuario.rol).toBe('AGENTE');
    expect(despues.body.usuario.roles).toEqual(['AGENTE', 'DOCENTE']);
    expect(despues.body.usuario.tieneAgente).toBe(true);
    expect(despues.body.usuario.tieneDocente).toBe(true);

    await request(app.getHttpServer())
      .get('/proyectos/mios')
      .set(autenticado(token))
      .expect(200);
  });

  it('un docente normal no puede activar el perfil de agente', async () => {
    const token = await iniciarSesion(app, semilla.correos.docenteA);
    await request(app.getHttpServer())
      .post('/agentes/mi-perfil-docente')
      .set(autenticado(token))
      .send({
        gradoAcademico: 'Maestría',
        especialidad: 'Prueba',
        numeroEmpleado: 'EMP-DOCENTE-001',
        materiaId: semilla.materiaAId,
        periodoEscolar: '2026-2',
      })
      .expect(401);
  });
});
