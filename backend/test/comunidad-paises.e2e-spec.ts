/**
 * Comunidad CACE: añadir banderas escribiendo el **nombre** o el código ISO.
 *
 * Antes había que saberse el código (`MX`) y escribir el nombre a mano. Ahora
 * basta con uno de los dos: el servidor busca el otro en su catálogo, con
 * tildes, mayúsculas y espacios incluidos. Si los dos vienen y no coinciden,
 * responde 400 para no guardar un país con la bandera de otro.
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

describe('Comunidad CACE: países por nombre o por ISO', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let token = '';

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
    token = await iniciarSesion(app, semilla.correos.presidencia);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. con solo el nombre busca el código ISO (y guarda «México» con tilde)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ nombre: 'mexico' })
      .expect(201);

    expect(respuesta.body.codigo).toBe('MX');
    expect(respuesta.body.nombre).toBe('México');
    expect(respuesta.body.activo).toBe(true);
  });

  it('2. con solo el código ISO completa el nombre', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ codigo: 'cl' })
      .expect(201);

    expect(respuesta.body.codigo).toBe('CL');
    expect(respuesta.body.nombre).toBe('Chile');
  });

  it('3. acepta el nombre con mayúsculas y espacios de más', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ nombre: '  ARGENTINA  ' })
      .expect(201);

    expect(respuesta.body.codigo).toBe('AR');
    expect(respuesta.body.nombre).toBe('Argentina');
  });

  it('4. si vienen los dos y coinciden, se guardan', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ codigo: 'PE', nombre: 'Perú' })
      .expect(201);

    expect(respuesta.body.codigo).toBe('PE');
  });

  it('5. si el código y el nombre no coinciden, responde 400', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ codigo: 'MX', nombre: 'Perú' })
      .expect(400);

    expect(String(respuesta.body.message)).toContain('no corresponde');
  });

  it('6. un nombre que no es país responde 400 con pista', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ nombre: 'Narnia' })
      .expect(400);

    expect(String(respuesta.body.message)).toContain('No reconozco');
  });

  it('7. un código que no existe responde 400', async () => {
    await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ codigo: 'ZZ' })
      .expect(400);
  });

  it('8. sin nombre ni código responde 400', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ activo: true })
      .expect(400);

    expect(String(respuesta.body.message)).toContain('Escribe el nombre');
  });

  it('9. repetir el país (por nombre) responde 409: solapa con el código único', async () => {
    await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ nombre: 'Mexico' })
      .expect(409);
  });

  it('10. editar solo el nombre cambia también el código', async () => {
    const creado = await request(app.getHttpServer())
      .post('/cace/paises')
      .set(autenticado(token))
      .send({ nombre: 'Uruguay' })
      .expect(201);

    const editado = await request(app.getHttpServer())
      .patch(`/cace/paises/${creado.body.id as number}`)
      .set(autenticado(token))
      .send({ nombre: 'Paraguay' })
      .expect(200);

    expect(editado.body.codigo).toBe('PY');
    expect(editado.body.nombre).toBe('Paraguay');
  });

  it('11. la web pública ya muestra la bandera añadida', async () => {
    const publico = await request(app.getHttpServer())
      .get('/cace/publico')
      .expect(200);

    const paises = publico.body.paises as { codigo: string; nombre: string }[];
    expect(paises.some((p) => p.codigo === 'MX')).toBe(true);
  });
});
