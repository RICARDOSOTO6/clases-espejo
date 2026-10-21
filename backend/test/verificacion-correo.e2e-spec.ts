/**
 * Fase 1: verificación de correo al registrarse y cambio de correo.
 *
 * - Una cuenta nueva nace sin confirmar: el login responde 403 hasta abrir el
 *   enlace del correo. Se puede pedir otro enlace (el anterior deja de valer).
 * - El cambio de correo se confirma desde la **dirección nueva**; hasta
 *   entonces el correo actual sigue siendo el de acceso, y al confirmarlo se
 *   cierran las sesiones abiertas.
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

describe('Fase 1: verificación de correo y cambio de dirección', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let correo: CorreoSimulado;
  let semilla: Semilla;

  const correoNuevoAgente = 'verifica@prueba.mx';
  const correoNuevoDocente = 'docente.a.nuevo@prueba.mx';

  /** Último token de confirmación enviado a esa dirección. */
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

  const altaVerificacion = {
    nombres: 'Verifica',
    apellidoPaterno: 'Correo',
    apellidoMaterno: 'Prueba',
    tipoDocumento: 'DNI',
    dni: 'VERI0001',
    correo: correoNuevoAgente,
    password: PASSWORD_PRUEBA,
    nombreInstitucion: 'Universidad de Verificación',
    pais: 'México',
    codigoPais: 'MX',
    estado: 'Campeche',
    ciudad: 'Calkiní',
    telefono: '+52 981 333 3333',
    correoInstitucional: 'contacto@verificacion.prueba',
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

  it('1. el registro nace sin confirmar y el login se niega (403)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(altaVerificacion)
      .expect(201);

    const usuario = await prisma.usuario.findUnique({
      where: { correo: correoNuevoAgente },
    });
    expect(usuario?.correoVerificado).toBe(false);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: correoNuevoAgente, password: PASSWORD_PRUEBA })
      .expect(403);
    expect(String(login.body.message)).toContain('confirma tu correo');
  });

  it('2. reenviar el enlace invalida el anterior y el nuevo confirma la cuenta', async () => {
    const tokenViejo = tokenConfirmacionDe(correoNuevoAgente);

    await request(app.getHttpServer())
      .post('/auth/confirmar-correo/reenviar')
      .send({ correo: correoNuevoAgente })
      .expect(201);

    // El enlace anterior ya no vale.
    await request(app.getHttpServer())
      .get('/auth/confirmar-correo')
      .query({ token: tokenViejo })
      .expect(400);

    const tokenNuevo = tokenConfirmacionDe(correoNuevoAgente);
    expect(tokenNuevo).not.toBe(tokenViejo);

    await request(app.getHttpServer())
      .get('/auth/confirmar-correo')
      .query({ token: tokenNuevo })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: correoNuevoAgente, password: PASSWORD_PRUEBA })
      .expect(201);
  });

  it('3. el enlace de confirmación es de un solo uso (400)', async () => {
    const token = tokenConfirmacionDe(correoNuevoAgente);
    await request(app.getHttpServer())
      .get('/auth/confirmar-correo')
      .query({ token })
      .expect(400);
  });

  it('4. cambiar de correo: se confirma en la dirección nueva y cierra la sesión', async () => {
    const tokenSesion = await iniciarSesion(app, semilla.correos.docenteA);

    await request(app.getHttpServer())
      .put('/auth/correo')
      .set(autenticado(tokenSesion))
      .send({ correo: correoNuevoDocente })
      .expect(200);

    // Hasta confirmar, el acceso sigue siendo con el correo anterior.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: semilla.correos.docenteA, password: PASSWORD_PRUEBA })
      .expect(201);

    const token = tokenConfirmacionDe(correoNuevoDocente);
    expect(token.length).toBeGreaterThan(20);

    await esperar(1100);
    const confirmado = await request(app.getHttpServer())
      .get('/auth/confirmar-correo')
      .query({ token })
      .expect(200);
    expect(confirmado.body.tipo).toBe('CAMBIO');
    expect(confirmado.body.correo).toBe(correoNuevoDocente);

    // La sesión abierta antes del cambio deja de valer.
    await request(app.getHttpServer())
      .get('/usuarios/me')
      .set(autenticado(tokenSesion))
      .expect(401);

    // El correo viejo ya no entra; el nuevo sí.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: semilla.correos.docenteA, password: PASSWORD_PRUEBA })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: correoNuevoDocente, password: PASSWORD_PRUEBA })
      .expect(201);
  });

  it('5. no se puede cambiar a un correo que ya tiene otra cuenta (409)', async () => {
    const token = await iniciarSesion(app, semilla.correos.agenteA);
    await request(app.getHttpServer())
      .put('/auth/correo')
      .set(autenticado(token))
      .send({ correo: semilla.correos.agenteB })
      .expect(409);
  });

  it('6. no se puede cambiar al mismo correo (400)', async () => {
    const token = await iniciarSesion(app, semilla.correos.agenteB);
    await request(app.getHttpServer())
      .put('/auth/correo')
      .set(autenticado(token))
      .send({ correo: semilla.correos.agenteB })
      .expect(400);
  });

  it('7. un enlace de confirmación inventado no vale (400)', async () => {
    await request(app.getHttpServer())
      .get('/auth/confirmar-correo')
      .query({ token: 'inventado' })
      .expect(400);
  });

  it('8. reenviar a un correo sin cuenta responde igual (no revela nada)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/auth/confirmar-correo/reenviar')
      .send({ correo: 'no.existe@prueba.mx' })
      .expect(201);
    expect(String(respuesta.body.mensaje)).toContain('Si ese correo tiene');
  });
});
