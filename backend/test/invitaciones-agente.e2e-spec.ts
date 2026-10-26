/**
 * Invitación de agente por la presidencia: enlace copiable, cuestionario de la
 * institución y aprobación posterior de la CACE.
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

describe('Invitación de agente por la presidencia (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let tokenPresidente: string;
  let tokenSecretaria: string;
  let enlace: string;
  let institucionId: number;

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
    tokenPresidente = await iniciarSesion(app, semilla.correos.presidencia);
    tokenSecretaria = await iniciarSesion(app, semilla.correos.secretaria);
  });

  afterAll(async () => {
    await app.close();
  });

  it('la presidencia crea un enlace sin correo', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/cace/invitaciones-agente')
      .set(autenticado(tokenPresidente))
      .send({})
      .expect(201);
    expect(respuesta.body.enlace).toContain('/activar-agente?token=');
    expect(respuesta.body.correo).toBeUndefined();
    enlace = respuesta.body.enlace as string;
  });

  it('la secretaría de la CACE no puede crear invitaciones de agente', async () => {
    await request(app.getHttpServer())
      .post('/cace/invitaciones-agente')
      .set(autenticado(tokenSecretaria))
      .send({})
      .expect(403);
  });

  it('el token se valida y la persona crea su institución', async () => {
    const token = new URL(enlace).searchParams.get('token');
    await request(app.getHttpServer())
      .get('/auth/invitacion-agente')
      .query({ token })
      .expect(200);

    const activacion = await request(app.getHttpServer())
      .post('/auth/activar-agente')
      .send({
        token,
        nombres: 'Agente',
        apellidoPaterno: 'Invitado',
        apellidoMaterno: 'Presidencia',
        tipoDocumento: 'DNI',
        dni: 'AGINV001',
        correo: 'agente.invitado@prueba.mx',
        password: 'PruebaSegura2026',
        aceptaAviso: true,
        nombreInstitucion: 'Institución Invitada de Prueba',
        pais: 'México',
        codigoPais: 'MX',
        estado: 'Campeche',
        ciudad: 'Campeche',
        telefono: '+52 981 111 1111',
        correoInstitucional: 'contacto@invitada.mx',
        cargo: 'Coordinador de Internacionalización',
      })
      .expect(201);

    expect(activacion.body.institucion.estadoCace).toBe('PENDIENTE');
    institucionId = activacion.body.institucion.id as number;

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        correo: 'agente.invitado@prueba.mx',
        password: 'PruebaSegura2026',
      })
      .expect(201);
    expect(login.body.usuario.rol).toBe('AGENTE');
  });

  it('la institución queda pendiente hasta que la presidencia la aprueba', async () => {
    const pendiente = await prisma.institucion.findUniqueOrThrow({
      where: { id: institucionId },
      select: { estadoCace: true, registroCompleto: true },
    });
    expect(pendiente.estadoCace).toBe('PENDIENTE');
    expect(pendiente.registroCompleto).toBe(true);

    await request(app.getHttpServer())
      .post(`/cace/instituciones/${institucionId}/aprobar`)
      .set(autenticado(tokenPresidente))
      .expect(201);

    const aprobada = await prisma.institucion.findUniqueOrThrow({
      where: { id: institucionId },
      select: { estadoCace: true },
    });
    expect(aprobada.estadoCace).toBe('APROBADA');
  });

  it('el enlace no se puede reutilizar', async () => {
    const token = new URL(enlace).searchParams.get('token');
    await request(app.getHttpServer())
      .post('/auth/activar-agente')
      .send({
        token,
        nombres: 'Otra',
        apellidoPaterno: 'Persona',
        apellidoMaterno: 'Prueba',
        tipoDocumento: 'DNI',
        dni: 'AGINV002',
        correo: 'otra.persona@prueba.mx',
        password: 'PruebaSegura2026',
        aceptaAviso: true,
        nombreInstitucion: 'Otra Institución',
        pais: 'México',
        codigoPais: 'MX',
        estado: 'Campeche',
        ciudad: 'Campeche',
        telefono: '+52 981 222 2222',
        correoInstitucional: 'contacto@otra.mx',
        cargo: 'Coordinador',
      })
      .expect(400);
  });
});
