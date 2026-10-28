import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  autenticado,
  crearAppE2E,
  limpiarBase,
  PASSWORD_PRUEBA,
  sembrarBase,
  type AppE2E,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';
import { codigoTotp } from '../src/common/totp';

jest.setTimeout(60000);

describe('Segundo factor TOTP de la CACE', () => {
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

  function login(correo: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo, password: PASSWORD_PRUEBA });
  }

  it('solo la CACE puede consultar o configurar TOTP', async () => {
    const agente = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        correo: semilla.correos.agenteA,
        password: PASSWORD_PRUEBA,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/auth/totp/estado')
      .set(autenticado(agente.body.access_token))
      .expect(403);
  });

  it('configura TOTP, lo exige en el login y acepta códigos de recuperación', async () => {
    const anterior = await login(semilla.correos.presidencia).expect(201);
    const token = anterior.body.access_token as string;

    const estadoInicial = await request(app.getHttpServer())
      .get('/auth/totp/estado')
      .set(autenticado(token))
      .expect(200);
    expect(estadoInicial.body.habilitado).toBe(false);

    const inicio = await request(app.getHttpServer())
      .post('/auth/totp/iniciar')
      .set(autenticado(token))
      .expect(201);
    expect(inicio.body.secreto).toMatch(/^[A-Z2-7]{16,}$/);
    expect(inicio.body.uri).toContain('otpauth://totp/');
    expect(inicio.body.qrDataUrl).toContain('data:image/png;base64,');

    const confirmacion = await request(app.getHttpServer())
      .post('/auth/totp/confirmar')
      .set(autenticado(token))
      .send({ codigo: codigoTotp(inicio.body.secreto) })
      .expect(201);
    expect(confirmacion.body.habilitado).toBe(true);
    expect(confirmacion.body.codigosRecuperacion).toHaveLength(8);

    // La contraseña correcta ya no entrega token: pide el segundo paso.
    const primerPaso = await login(semilla.correos.presidencia).expect(201);
    expect(primerPaso.body.requiereTotp).toBe(true);
    expect(primerPaso.body.access_token).toBeUndefined();
    expect(primerPaso.body.challengeToken).toEqual(expect.any(String));

    const segundoPaso = await request(app.getHttpServer())
      .post('/auth/totp/verificar')
      .send({
        challengeToken: primerPaso.body.challengeToken,
        codigo: codigoTotp(inicio.body.secreto, Date.now() + 30_000),
      })
      .expect(201);
    expect(segundoPaso.body.access_token).toEqual(expect.any(String));

    // El mismo código no se puede reutilizar.
    await request(app.getHttpServer())
      .post('/auth/totp/verificar')
      .send({
        challengeToken: primerPaso.body.challengeToken,
        codigo: codigoTotp(inicio.body.secreto, Date.now() + 30_000),
      })
      .expect(401);

    // Un código de recuperación también sirve y se consume.
    const conRecuperacion = await login(semilla.correos.presidencia).expect(
      201,
    );
    const codigoRecuperacion = confirmacion.body
      .codigosRecuperacion[0] as string;

    const sesionRecuperacion = await request(app.getHttpServer())
      .post('/auth/totp/verificar')
      .send({
        challengeToken: conRecuperacion.body.challengeToken,
        codigo: codigoRecuperacion,
      })
      .expect(201);
    expect(sesionRecuperacion.body.access_token).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/auth/totp/verificar')
      .send({
        challengeToken: conRecuperacion.body.challengeToken,
        codigo: codigoRecuperacion,
      })
      .expect(401);

    const estadoFinal = await request(app.getHttpServer())
      .get('/auth/totp/estado')
      .set(autenticado(sesionRecuperacion.body.access_token))
      .expect(200);
    expect(estadoFinal.body.habilitado).toBe(true);
    expect(estadoFinal.body.codigosRestantes).toBe(7);
  });

  it('desactiva TOTP con contraseña y un código válido', async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { correo: semilla.correos.presidencia },
      select: { totpSecret: true },
    });
    expect(usuario.totpSecret).toEqual(expect.any(String));

    // El código de la prueba anterior ya consumió el paso actual; para probar
    // otra operación con un código TOTP se reinicia el contador de prueba.
    await prisma.usuario.update({
      where: { correo: semilla.correos.presidencia },
      data: { totpUltimoPaso: 0 },
    });

    const loginActual = await login(semilla.correos.presidencia).expect(201);
    expect(loginActual.body.requiereTotp).toBe(true);
    const verificado = await request(app.getHttpServer())
      .post('/auth/totp/verificar')
      .send({
        challengeToken: loginActual.body.challengeToken,
        codigo: codigoTotp(usuario.totpSecret!, Date.now() + 30_000),
      })
      .expect(201);

    await prisma.usuario.update({
      where: { correo: semilla.correos.presidencia },
      data: { totpUltimoPaso: 0 },
    });

    const desactivado = await request(app.getHttpServer())
      .post('/auth/totp/desactivar')
      .set(autenticado(verificado.body.access_token))
      .send({
        password: PASSWORD_PRUEBA,
        codigo: codigoTotp(usuario.totpSecret!, Date.now() + 30_000),
      })
      .expect(201);
    expect(desactivado.body.habilitado).toBe(false);

    const loginFinal = await login(semilla.correos.presidencia).expect(201);
    expect(loginFinal.body.access_token).toEqual(expect.any(String));
    expect(loginFinal.body.requiereTotp).toBeUndefined();
  });
});
