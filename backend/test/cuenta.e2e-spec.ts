/**
 * Flujo de cuenta y acceso (Fase 1): recuperar contraseña, política de
 * contraseñas, bloqueo por intentos fallidos y cierre de sesiones al cambiarla.
 *
 * El correo va simulado: de la llamada `sendRecuperacionPassword` se saca el
 * token que iría en el enlace, para poder recorrer el flujo completo sin SMTP.
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
  type CorreoSimulado,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';
import { PASSWORD_PRUEBA } from './base-e2e';

jest.setTimeout(90000);

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Fase 1: cuenta y acceso', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let correo: CorreoSimulado;
  let semilla: Semilla;

  const tokenDe = (destinatario: string): string => {
    const llamada = [...correo.llamadas]
      .reverse()
      .find(
        (l) =>
          l.metodo === 'sendRecuperacionPassword' &&
          l.argumentos[0] === destinatario,
      );
    const valor = llamada?.argumentos[1];
    return typeof valor === 'string' ? valor : '';
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

  it('1. pedir recuperación responde igual exista o no la cuenta', async () => {
    const existente = await request(app.getHttpServer())
      .post('/auth/recuperar')
      .send({ correo: semilla.correos.agenteA })
      .expect(201);
    const inventado = await request(app.getHttpServer())
      .post('/auth/recuperar')
      .send({ correo: 'nadie@prueba.mx' })
      .expect(201);

    expect(existente.body.mensaje).toBe(inventado.body.mensaje);
    expect(String(existente.body.mensaje)).toContain('Si ese correo tiene');
  });

  it('2. la cuenta existente recibe un enlace y solo se guarda su hash', async () => {
    const llamada = correo.llamadas.find(
      (l) =>
        l.metodo === 'sendRecuperacionPassword' &&
        l.argumentos[0] === semilla.correos.agenteA,
    );
    expect(llamada).toBeTruthy();

    const token = tokenDe(semilla.correos.agenteA);
    expect(token.length).toBeGreaterThan(20);

    const registros = await prisma.recuperacionPassword.findMany();
    expect(registros).toHaveLength(1);
    expect(registros[0].tokenHash).not.toBe(token);
    expect(registros[0].tokenHash).toHaveLength(64);
    expect(registros[0].expira.getTime()).toBeGreaterThan(Date.now());
  });

  it('3. el enlace se puede validar antes de usarlo', async () => {
    const token = tokenDe(semilla.correos.agenteA);
    const respuesta = await request(app.getHttpServer())
      .get('/auth/recuperar/validar')
      .query({ token })
      .expect(200);
    expect(respuesta.body.valido).toBe(true);
    expect(respuesta.body.correo).toBe(semilla.correos.agenteA);
  });

  it('4. un token inventado no es válido (400)', async () => {
    await request(app.getHttpServer())
      .get('/auth/recuperar/validar')
      .query({ token: 'inventado' })
      .expect(400);
  });

  it('5. restablecer rechaza una contraseña corta (400)', async () => {
    const token = tokenDe(semilla.correos.agenteA);
    await request(app.getHttpServer())
      .post('/auth/restablecer')
      .send({ token, password: 'corta' })
      .expect(400);
  });

  it('6. restablecer rechaza la contraseña igual al correo (400)', async () => {
    const token = tokenDe(semilla.correos.agenteA);
    await request(app.getHttpServer())
      .post('/auth/restablecer')
      .send({ token, password: semilla.correos.agenteA })
      .expect(400);
  });

  it('7. restablecer bien: la anterior deja de valer, la nueva entra y la sesión vieja se cierra', async () => {
    const token = tokenDe(semilla.correos.agenteA);
    const tokenSesionVieja = await iniciarSesion(app, semilla.correos.agenteA);

    // Se espera al segundo siguiente: `iat` del token va en segundos.
    await esperar(1100);

    await request(app.getHttpServer())
      .post('/auth/restablecer')
      .send({ token, password: 'ClaveNueva123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: semilla.correos.agenteA, password: PASSWORD_PRUEBA })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: semilla.correos.agenteA, password: 'ClaveNueva123' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/usuarios/me')
      .set(autenticado(tokenSesionVieja))
      .expect(401);
  });

  it('8. el mismo enlace no se puede usar dos veces (400)', async () => {
    const token = tokenDe(semilla.correos.agenteA);
    await request(app.getHttpServer())
      .post('/auth/restablecer')
      .send({ token, password: 'OtraClave123' })
      .expect(400);
  });

  it('9. un enlace caducado se rechaza (400)', async () => {
    await request(app.getHttpServer())
      .post('/auth/recuperar')
      .send({ correo: semilla.correos.agenteB })
      .expect(201);

    const token = tokenDe(semilla.correos.agenteB);
    await prisma.recuperacionPassword.updateMany({
      where: { usuario: { correo: semilla.correos.agenteB } },
      data: { expira: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/auth/restablecer')
      .send({ token, password: 'ClaveNueva456' })
      .expect(400);
  });

  it('10. el registro exige la política de contraseñas', async () => {
    const alta = {
      nombres: 'Politica',
      apellidoPaterno: 'Prueba',
      apellidoMaterno: 'Uno',
      tipoDocumento: 'DNI',
      dni: 'POLI0001',
      correo: 'politica@prueba.mx',
      nombreInstitucion: 'Universidad de Política',
      pais: 'México',
      codigoPais: 'MX',
      estado: 'Campeche',
      ciudad: 'Calkiní',
      telefono: '+52 981 222 2222',
      correoInstitucional: 'contacto@politica.prueba',
      cargo: 'Coordinador de Internacionalización',
    };

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...alta, password: 'corta' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...alta, password: 'politica@prueba.mx' })
      .expect(400);
  });

  it('11. cinco intentos fallidos bloquean la cuenta y un enlace la desbloquea', async () => {
    const correoDocente = semilla.correos.docenteB;

    for (let intento = 1; intento <= 5; intento += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ correo: correoDocente, password: 'inventada' })
        .expect(401);
    }

    const aviso = correo.llamadas.find(
      (llamada) =>
        llamada.metodo === 'sendAvisoBloqueo' &&
        llamada.argumentos[0] === correoDocente,
    );
    expect(aviso).toBeDefined();

    // Con la contraseña correcta tampoco se entra: sigue bloqueada.
    const bloqueada = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: correoDocente, password: PASSWORD_PRUEBA })
      .expect(401);
    expect(String(bloqueada.body.message)).toContain('bloqueada');

    // El enlace de recuperación sirve para desbloquearla.
    await request(app.getHttpServer())
      .post('/auth/recuperar')
      .send({ correo: correoDocente })
      .expect(201);
    const token = tokenDe(correoDocente);
    await request(app.getHttpServer())
      .post('/auth/restablecer')
      .send({ token, password: 'Desbloqueada123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: correoDocente, password: 'Desbloqueada123' })
      .expect(201);
  });

  it('12. cambiar la contraseña cierra la sesión abierta (401)', async () => {
    const token = await iniciarSesion(app, semilla.correos.docenteA);

    await esperar(1100);

    await request(app.getHttpServer())
      .post('/usuarios/me/password')
      .set(autenticado(token))
      .send({ actual: PASSWORD_PRUEBA, nueva: 'Cambiada12345' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/usuarios/me')
      .set(autenticado(token))
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: semilla.correos.docenteA, password: 'Cambiada12345' })
      .expect(201);
  });
});
