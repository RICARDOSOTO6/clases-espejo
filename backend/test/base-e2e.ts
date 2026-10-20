/**
 * Utilidades compartidas por las pruebas e2e.
 *
 * Reglas de esta base de pruebas:
 *
 * - **Nunca toca la base real.** `exigirBaseDePrueba()` se niega a arrancar si
 *   `DATABASE_URL` no apunta a una base cuyo nombre termine en `_test` o `_ci`.
 *   Así un `npm run test:e2e` lanzado por error contra la base de demostración
 *   se detiene antes de borrar nada.
 * - **El correo se simula.** `MailService` se sustituye por un doble que
 *   apunta las llamadas, para que las pruebas no dependan de un SMTP real ni
 *   manden correos de verdad.
 * - **Cada suite parte de cero.** `limpiarBase()` vacía las tablas (sin tocar
 *   `_prisma_migrations`) y `sembrarBase()` crea dos instituciones aprobadas con
 *   sus agentes, docentes, presidencia y secretaría.
 */
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

/** Contraseña común de todas las cuentas sembradas. */
export const PASSWORD_PRUEBA = 'Demo1234';

export interface LlamadaCorreo {
  metodo: string;
  argumentos: unknown[];
}

export interface CorreoSimulado {
  llamadas: LlamadaCorreo[];
}

export interface AppE2E {
  app: INestApplication;
  prisma: PrismaService;
  correo: CorreoSimulado;
}

/** Nombre de la base a la que apunta `DATABASE_URL` ('' si no se puede leer). */
export function nombreDeBaseDeDatos(): string {
  const url = process.env.DATABASE_URL ?? '';
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

/**
 * Aborta si la base configurada no es de pruebas. Es la única protección que
 * impide que un `TRUNCATE` accidental borre la base de demostración.
 */
export function exigirBaseDePrueba(): void {
  const nombre = nombreDeBaseDeDatos();
  if (!/_(test|ci)$/.test(nombre)) {
    throw new Error(
      `Las pruebas e2e no corren contra «${nombre || '(sin base)'}»: ` +
        'DATABASE_URL debe apuntar a una base cuyo nombre termine en _test o _ci.',
    );
  }
}

/** Métodos de `MailService` que la aplicación puede llamar. */
const METODOS_CORREO = [
  'sendInvitation',
  'sendCredencialesPresidente',
  'sendCredencialesSecretaria',
  'sendCambioPresidenciaEntrante',
  'sendCambioPresidenciaSaliente',
  'sendInstitucionAprobada',
  'sendInstitucionRechazada',
  'sendInstitucionVetada',
  'sendAltaAgentePendiente',
  'sendAltaAgenteConfirmada',
  'sendAltaAgenteRechazada',
  'sendCertificadoAlumno',
  'sendCalendarioClase',
] as const;

/**
 * Doble de `MailService`: no envía nada y apunta qué se le pidió.
 *
 * Se construye con métodos explícitos y **no** con un `Proxy`: un objeto cuya
 * propiedad `then` devuelve una función se comporta como una promesa que nunca
 * se resuelve, y `await` se queda colgado.
 */
function crearCorreoSimulado(): {
  correo: CorreoSimulado;
  servicio: MailService;
} {
  const correo: CorreoSimulado = { llamadas: [] };
  const servicio: Record<string, unknown> = {};
  for (const metodo of METODOS_CORREO) {
    servicio[metodo] = (...argumentos: unknown[]): Promise<void> => {
      correo.llamadas.push({ metodo, argumentos });
      return Promise.resolve();
    };
  }
  return { correo, servicio: servicio as unknown as MailService };
}

/**
 * Levanta la aplicación completa (como en producción: mismos pipes y filtros
 * globales) con el correo simulado.
 */
export async function crearAppE2E(): Promise<AppE2E> {
  exigirBaseDePrueba();

  const { correo, servicio } = crearCorreoSimulado();
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(servicio)
    .compile();

  const app = modulo.createNestApplication();
  // Lo mismo que hace main.ts: sin esto, los DTO no se validan y las pruebas
  // no reproducirían el comportamiento real.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.init();

  return { app, prisma: app.get(PrismaService), correo };
}

/** Vacía todas las tablas del esquema público menos el historial de Prisma. */
export async function limpiarBase(prisma: PrismaService): Promise<void> {
  const tablas = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );
  const lista = tablas.map((t) => `"${t.tablename}"`).join(', ');
  if (lista) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`,
    );
  }
}

export interface Semilla {
  institucionAId: number;
  institucionBId: number;
  usuarioAgenteA: number;
  usuarioAgenteB: number;
  usuarioDocenteA: number;
  usuarioDocenteB: number;
  usuarioPresidencia: number;
  usuarioSecretaria: number;
  correos: {
    agenteA: string;
    agenteB: string;
    docenteA: string;
    docenteB: string;
    presidencia: string;
    secretaria: string;
  };
}

/**
 * Siembra dos instituciones **aprobadas por la CACE** con su agente confirmado,
 * un docente con su vínculo institucional, y la presidencia y secretaría.
 *
 * Los nombres y correos llevan el sufijo `.prueba` para que, si alguien mira
 * una base de pruebas, sepa de inmediato que esos datos no son reales.
 */
export async function sembrarBase(prisma: PrismaService): Promise<Semilla> {
  // Coste 4 basta para comparar: el hash no sale de esta base de pruebas.
  const passwordHash = await bcrypt.hash(PASSWORD_PRUEBA, 4);

  const crearInstitucion = (nombre: string, pais: string, codigo: string) =>
    prisma.institucion.create({
      data: {
        nombre,
        pais,
        codigoPais: codigo,
        estado: pais === 'México' ? 'Campeche' : 'Cundinamarca',
        ciudad: pais === 'México' ? 'Calkiní' : 'Bogotá',
        telefono: '+52 981 000 0000',
        correoInstitucional: `contacto@${codigo.toLowerCase()}.prueba`,
        activa: true,
        registroCompleto: true,
        estadoCace: 'APROBADA',
      },
    });

  const institucionA = await crearInstitucion(
    'Institución de Prueba A',
    'México',
    'MX',
  );
  const institucionB = await crearInstitucion(
    'Institución de Prueba B',
    'Colombia',
    'CO',
  );

  const crearUsuario = (
    nombres: string,
    apellidos: [string, string],
    dni: string,
    correo: string,
  ) =>
    prisma.usuario.create({
      data: {
        nombres,
        apellidoPaterno: apellidos[0],
        apellidoMaterno: apellidos[1],
        dni,
        tipoDocumento: 'DNI',
        correo,
        passwordHash,
      },
    });

  const agenteA = await crearUsuario(
    'Agente',
    ['Alfa', 'Prueba'],
    'PRUEA001',
    'agente.a@prueba.mx',
  );
  const agenteB = await crearUsuario(
    'Agente',
    ['Beta', 'Prueba'],
    'PRUEB001',
    'agente.b@prueba.co',
  );
  const docenteA = await crearUsuario(
    'Docente',
    ['Alfa', 'Prueba'],
    'PRUED001',
    'docente.a@prueba.mx',
  );
  const docenteB = await crearUsuario(
    'Docente',
    ['Beta', 'Prueba'],
    'PRUED002',
    'docente.b@prueba.co',
  );
  const presidencia = await crearUsuario(
    'Presidencia',
    ['CACE', 'Prueba'],
    'PRUEP001',
    'presidencia@prueba.mx',
  );
  const secretaria = await crearUsuario(
    'Secretaría',
    ['CACE', 'Prueba'],
    'PRUES001',
    'secretaria@prueba.mx',
  );

  await prisma.agenteInternacionalizacion.create({
    data: {
      usuarioId: agenteA.id,
      institucionId: institucionA.id,
      cargo: 'Coordinador de Internacionalización',
      confirmadoEn: new Date(),
    },
  });
  await prisma.agenteInternacionalizacion.create({
    data: {
      usuarioId: agenteB.id,
      institucionId: institucionB.id,
      cargo: 'Coordinador de Internacionalización',
      confirmadoEn: new Date(),
    },
  });

  const docenteRegistroA = await prisma.docente.create({
    data: {
      usuarioId: docenteA.id,
      gradoAcademico: 'Maestría',
      especialidad: 'Ingeniería de Software',
    },
  });
  const docenteRegistroB = await prisma.docente.create({
    data: {
      usuarioId: docenteB.id,
      gradoAcademico: 'Doctorado',
      especialidad: 'Ciencias de la Computación',
    },
  });

  await prisma.docenteInstitucion.create({
    data: {
      docenteId: docenteRegistroA.id,
      institucionId: institucionA.id,
      numeroEmpleado: 'DOC-A-001',
      activo: true,
    },
  });
  await prisma.docenteInstitucion.create({
    data: {
      docenteId: docenteRegistroB.id,
      institucionId: institucionB.id,
      numeroEmpleado: 'DOC-B-001',
      activo: true,
    },
  });

  await prisma.miembroCace.create({
    data: { usuarioId: presidencia.id, cargo: 'PRESIDENTE', activo: true },
  });
  await prisma.miembroCace.create({
    data: { usuarioId: secretaria.id, cargo: 'SECRETARIA', activo: true },
  });

  return {
    institucionAId: institucionA.id,
    institucionBId: institucionB.id,
    usuarioAgenteA: agenteA.id,
    usuarioAgenteB: agenteB.id,
    usuarioDocenteA: docenteA.id,
    usuarioDocenteB: docenteB.id,
    usuarioPresidencia: presidencia.id,
    usuarioSecretaria: secretaria.id,
    correos: {
      agenteA: agenteA.correo,
      agenteB: agenteB.correo,
      docenteA: docenteA.correo,
      docenteB: docenteB.correo,
      presidencia: presidencia.correo,
      secretaria: secretaria.correo,
    },
  };
}
