/**
 * Flujo crítico 1: registro de un agente → aprobación de su institución por la
 * CACE → invitación de un docente → activación de la cuenta del docente.
 *
 * Comprueba de paso las dos puertas del registro:
 * - Mientras la institución está PENDIENTE, el agente **no** puede invitar
 *   docentes ni operar (403), aunque sí puede completar los datos de la
 *   institución.
 * - La invitación es de **un solo uso**: la segunda activación responde 400.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  crearAppE2E,
  limpiarBase,
  sembrarBase,
  PASSWORD_PRUEBA,
  type AppE2E,
  type CorreoSimulado,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('Flujo 1: registro, aprobación, invitación y activación', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let correo: CorreoSimulado;
  let semilla: Semilla;

  let tokenAgente = '';
  let tokenPresidencia = '';
  let institucionId = 0;
  let tokenInvitacion = '';

  const correoAgenteNuevo = 'nuevo.agente@prueba.mx';
  const correoDocenteNuevo = 'nuevo.docente@prueba.mx';

  /** Token del correo de confirmación que se habría enviado a esa dirección. */
  const tokenConfirmacionDe = (destinatario: string): string => {
    const llamada = [...correo.llamadas]
      .reverse()
      .find(
        (l) =>
          l.metodo === 'sendConfirmacionCorreo' &&
          l.argumentos[0] === destinatario,
      );
    const valor = llamada?.argumentos[1];
    return typeof valor === 'string' ? valor : '';
  };

  const altaAgente = {
    nombres: 'Nuevo',
    apellidoPaterno: 'Agente',
    apellidoMaterno: 'Prueba',
    tipoDocumento: 'DNI',
    dni: 'NUEVA001',
    correo: correoAgenteNuevo,
    password: PASSWORD_PRUEBA,
    nombreInstitucion: 'Universidad Nueva de Prueba',
    pais: 'México',
    codigoPais: 'MX',
    estado: 'Campeche',
    ciudad: 'San Francisco de Campeche',
    telefono: '+52 981 111 1111',
    correoInstitucional: 'contacto@nueva.prueba',
    cargo: 'Coordinador de Internacionalización',
  };

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    correo = e2e.correo;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. registra un agente con una institución nueva, que nace PENDIENTE', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/auth/register')
      .send(altaAgente)
      .expect(201);

    expect(respuesta.body.usuario.rol).toBe('AGENTE');
    expect(respuesta.body.institucion.estadoCace).toBe('PENDIENTE');
    institucionId = respuesta.body.institucion.id;
    expect(institucionId).toBeGreaterThan(0);
  });

  it('2. sin confirmar el correo no se puede entrar; con el enlace, sí', async () => {
    // La cuenta nace pendiente de confirmar: el login responde 403.
    const bloqueado = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: correoAgenteNuevo, password: PASSWORD_PRUEBA })
      .expect(403);
    expect(String(bloqueado.body.message)).toContain('confirma tu correo');

    const token = tokenConfirmacionDe(correoAgenteNuevo);
    expect(token.length).toBeGreaterThan(20);
    await request(app.getHttpServer())
      .get('/auth/confirmar-correo')
      .query({ token })
      .expect(200);

    const respuesta = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: correoAgenteNuevo, password: PASSWORD_PRUEBA })
      .expect(201);

    tokenAgente = respuesta.body.access_token;
    expect(tokenAgente).toBeTruthy();

    const mia = await request(app.getHttpServer())
      .get('/instituciones/mia')
      .set('Authorization', `Bearer ${tokenAgente}`)
      .expect(200);
    expect(mia.body.estadoCace).toBe('PENDIENTE');
    expect(mia.body.registroCompleto).toBe(false);
  });

  it('3. con la institución pendiente, el agente no puede invitar docentes (403)', async () => {
    await request(app.getHttpServer())
      .post('/agentes/invitar-docente')
      .set('Authorization', `Bearer ${tokenAgente}`)
      .send({ correo: correoDocenteNuevo, numeroEmpleado: 'DOC-N-001' })
      .expect(403);

    // El intento bloqueado no debe haber dejado ninguna invitación a medias.
    const invitaciones = await prisma.invitacion.count({
      where: { correo: correoDocenteNuevo },
    });
    expect(invitaciones).toBe(0);
  });

  it('4. el agente completa los datos de su institución (registro completo)', async () => {
    await request(app.getHttpServer())
      .patch('/instituciones/mia')
      .set('Authorization', `Bearer ${tokenAgente}`)
      .send({
        nombre: 'Universidad Nueva de Prueba',
        pais: 'México',
        codigoPais: 'MX',
        estado: 'Campeche',
        ciudad: 'San Francisco de Campeche',
        telefono: '+52 981 111 1111',
        correoInstitucional: 'contacto@nueva.prueba',
      })
      .expect(200);

    const mia = await request(app.getHttpServer())
      .get('/instituciones/mia')
      .set('Authorization', `Bearer ${tokenAgente}`)
      .expect(200);
    expect(mia.body.registroCompleto).toBe(true);
  });

  it('5. completar los datos no basta: sin aprobación de la CACE sigue cerrado (403)', async () => {
    await request(app.getHttpServer())
      .post('/agentes/invitar-docente')
      .set('Authorization', `Bearer ${tokenAgente}`)
      .send({ correo: correoDocenteNuevo, numeroEmpleado: 'DOC-N-001' })
      .expect(403);
  });

  it('6. la presidencia aprueba la institución', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: semilla.correos.presidencia, password: PASSWORD_PRUEBA })
      .expect(201);
    tokenPresidencia = login.body.access_token;

    await request(app.getHttpServer())
      .post(`/cace/instituciones/${institucionId}/aprobar`)
      .set('Authorization', `Bearer ${tokenPresidencia}`)
      .expect(201);

    const listado = await request(app.getHttpServer())
      .get('/cace/instituciones')
      .set('Authorization', `Bearer ${tokenPresidencia}`)
      .expect(200);
    const instituciones: Array<{ id: number; estadoCace: string }> =
      listado.body;
    const aprobada = instituciones.find((i) => i.id === institucionId);
    expect(aprobada?.estadoCace).toBe('APROBADA');
  });

  it('7. con la institución aprobada, el panel del agente ya responde (200)', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/agentes/docentes')
      .set('Authorization', `Bearer ${tokenAgente}`)
      .expect(200);
    expect(Array.isArray(respuesta.body)).toBe(true);
  });

  it('8. el agente invita a un docente y se crea una invitación de un solo uso', async () => {
    await request(app.getHttpServer())
      .post('/agentes/invitar-docente')
      .set('Authorization', `Bearer ${tokenAgente}`)
      .send({ correo: correoDocenteNuevo, numeroEmpleado: 'DOC-N-001' })
      .expect(201);

    expect(correo.llamadas.some((l) => l.metodo === 'sendInvitation')).toBe(
      true,
    );

    const invitacion = await prisma.invitacion.findFirst({
      where: { correo: correoDocenteNuevo },
    });
    expect(invitacion).toBeTruthy();
    expect(invitacion?.usadaEn).toBeNull();
    tokenInvitacion = invitacion?.token ?? '';
    expect(tokenInvitacion.length).toBeGreaterThan(10);
  });

  it('9. el token de invitación es válido antes de usarse', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/auth/activate')
      .query({ token: tokenInvitacion })
      .expect(200);
    expect(respuesta.body.correo).toBe(correoDocenteNuevo);
  });

  it('10. el docente activa su cuenta con sus propias credenciales', async () => {
    await request(app.getHttpServer())
      .post('/auth/activate')
      .send({
        token: tokenInvitacion,
        nombres: 'Nuevo',
        apellidoPaterno: 'Docente',
        apellidoMaterno: 'Prueba',
        tipoDocumento: 'DNI',
        dni: 'NUEVD001',
        gradoAcademico: 'Maestría',
        especialidad: 'Redes de Computadoras',
        password: 'Docente1234',
      })
      .expect(201);
  });

  it('11. el docente ya puede iniciar sesión con el rol DOCENTE', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: correoDocenteNuevo, password: 'Docente1234' })
      .expect(201);
    expect(respuesta.body.usuario.rol).toBe('DOCENTE');
  });

  it('12. la misma invitación no se puede usar dos veces (400)', async () => {
    await request(app.getHttpServer())
      .post('/auth/activate')
      .send({
        token: tokenInvitacion,
        nombres: 'Otro',
        apellidoPaterno: 'Docente',
        apellidoMaterno: 'Prueba',
        tipoDocumento: 'DNI',
        dni: 'NUEVD002',
        gradoAcademico: 'Maestría',
        especialidad: 'Redes de Computadoras',
        password: 'Docente1234',
      })
      .expect(400);
  });

  it('13. una contraseña incorrecta no inicia sesión (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: semilla.correos.agenteA, password: 'incorrecta' })
      .expect(401);
  });

  it('14. una ruta protegida sin token responde 401', async () => {
    await request(app.getHttpServer()).get('/cace/instituciones').expect(401);
  });
});
