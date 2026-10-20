/**
 * Flujo crítico 3: la matriz de capacidades se cumple de verdad en el servidor.
 *
 * No basta con que la interfaz esconda botones: cada rol se prueba contra rutas
 * sensibles y se espera **200** si tiene la capacidad y **403** si no (o **401**
 * en las rutas que son de un rol concreto, que responden «esto no es tuyo»).
 * Las capacidades declaradas se comparan con la lista documentada, para que un
 * cambio en `common/capacidades.ts` obligue a revisar esta prueba.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  crearAppE2E,
  limpiarBase,
  sembrarBase,
  PASSWORD_PRUEBA,
  type AppE2E,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

/** Capacidades esperadas por rol, según la matriz documentada. */
const CAPACIDADES_ESPERADAS: Record<string, string[]> = {
  DOCENTE: ['emitirCertificados', 'anularCertificados'],
  AGENTE: ['confirmarAgenteInstitucion'],
  PRESIDENTE_CACE: [
    'aprobarInstituciones',
    'borrarInstituciones',
    'resolverSolicitudesBorrado',
    'gestionarMiembrosCace',
    'personalizarCace',
    'publicarPremios',
    'disenarCertificados',
    'firmarCertificados',
    'anularCertificados',
  ],
  SECRETARIA_CACE: [
    'personalizarCace',
    'publicarPremios',
    'solicitarBorradoInstitucion',
  ],
};

describe('Flujo 3: matriz de capacidades por rol', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;

  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);

    const entrada = async (correo: string): Promise<string> => {
      const respuesta = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ correo, password: PASSWORD_PRUEBA })
        .expect(201);
      return respuesta.body.access_token as string;
    };

    tokens.agente = await entrada(semilla.correos.agenteA);
    tokens.docente = await entrada(semilla.correos.docenteA);
    tokens.presidencia = await entrada(semilla.correos.presidencia);
    tokens.secretaria = await entrada(semilla.correos.secretaria);
  });

  afterAll(async () => {
    await app.close();
  });

  const pedir = (ruta: string, rol: string) =>
    request(app.getHttpServer())
      .get(ruta)
      .set('Authorization', `Bearer ${tokens[rol]}`);

  it('sin token, las rutas protegidas responden 401', async () => {
    await request(app.getHttpServer()).get('/agentes/docentes').expect(401);
    await request(app.getHttpServer()).get('/cace/instituciones').expect(401);
  });

  it('el agente puede con sus docentes y no con el panel de la CACE', async () => {
    await pedir('/agentes/docentes', 'agente').expect(200);
    await pedir('/cace/instituciones', 'agente').expect(403);
    // La confirmación de altas de agentes sí es suya.
    await pedir('/agentes/confirmaciones', 'agente').expect(200);
  });

  it('la secretaría ayuda con la imagen y los premios, pero no aprueba ni diseña', async () => {
    await pedir('/cace/premios', 'secretaria').expect(200);
    await pedir('/cace/instituciones', 'secretaria').expect(403);
    await pedir('/cace/certificados/plantilla', 'secretaria').expect(403);
  });

  it('la presidencia puede aprobar instituciones y diseñar el certificado', async () => {
    await pedir('/cace/instituciones', 'presidencia').expect(200);
    await pedir('/cace/certificados/plantilla', 'presidencia').expect(200);
    await pedir('/cace/miembros', 'presidencia').expect(200);
  });

  it('el docente ve sus clases pero no revisa solicitudes ni toca la CACE', async () => {
    await pedir('/proyectos/mios', 'docente').expect(200);
    // Las rutas que son «solo para un rol» responden 401 (no es un permiso de
    // capacidad, es que la ruta no es suya); las de capacidad, 403.
    await pedir('/solicitudes/entrantes', 'docente').expect(401);
    await pedir('/cace/instituciones', 'docente').expect(403);
  });

  it('el agente no puede ver «mis proyectos»: esa ruta es del docente (401)', async () => {
    await pedir('/proyectos/mios', 'agente').expect(401);
  });

  it('cada rol recibe exactamente las capacidades documentadas', async () => {
    for (const [rol, token] of [
      ['AGENTE', tokens.agente],
      ['DOCENTE', tokens.docente],
      ['PRESIDENTE_CACE', tokens.presidencia],
      ['SECRETARIA_CACE', tokens.secretaria],
    ] as const) {
      const respuesta = await request(app.getHttpServer())
        .get('/cace/capacidades')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.rol).toBe(rol);
      const recibidas = [...(respuesta.body.capacidades as string[])].sort();
      expect(recibidas).toEqual([...CAPACIDADES_ESPERADAS[rol]].sort());
      expect(respuesta.body.etiquetaRol).toBeTruthy();
    }
  });
});
