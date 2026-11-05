/**
 * Clase espejo con cuatro instituciones (e2e).
 *
 * La simulación se hizo a mano para ver si el sistema aguantaba más de dos
 * partes; esto la convierte en una prueba que se ejecuta en cada cambio. Monta
 * una clase con las dos instituciones de la solicitud (origen y destino) más dos
 * colaboradoras, que se invitan y aprueban por la API; cada docente sube la
 * lista de su institución, el reporte de la sesión lo firman los cuatro, se
 * cierra y cada uno emite **sus** certificados.
 *
 * Lo que se demuestra aquí y no en las pruebas de dos instituciones:
 *
 * - el reporte de la sesión no se da por confirmado hasta que firman **todos**
 *   los docentes, que ahora son cuatro;
 * - al emitir, cada institución se lleva exactamente los certificados de sus
 *   alumnos, sin colarse los de las demás;
 * - una institución que no fue invitada no puede leer la clase ni emitir en ella.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  autenticado,
  crearAppE2E,
  crearPlantillaDePrueba,
  crearProyectoDePrueba,
  iniciarSesion,
  limpiarBase,
  PASSWORD_PRUEBA,
  sembrarBase,
  type AppE2E,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(180000);

interface InstitucionExtra {
  institucionId: number;
  asignacionId: number;
  correoAgente: string;
  correoDocente: string;
}

interface DocenteDeLaClase {
  sufijo: string;
  institucionId: number;
  token: string;
}

/**
 * Crea una institución aprobada más, con su agente confirmado, su docente y una
 * materia asignada. Es lo mínimo para que pueda invitarse a la clase, y para que
 * su docente suba una lista y emita certificados.
 */
async function crearInstitucionExtra(
  prisma: PrismaService,
  datos: {
    nombre: string;
    pais: string;
    codigoPais: string;
    provincia: string;
    ciudad: string;
    sufijo: string;
    domicilio: string;
  },
): Promise<InstitucionExtra> {
  const institucion = await prisma.institucion.create({
    data: {
      nombre: datos.nombre,
      pais: datos.pais,
      codigoPais: datos.codigoPais,
      estado: datos.provincia,
      ciudad: datos.ciudad,
      telefono: '+00 000 000 0000',
      correoInstitucional: `contacto.${datos.sufijo.toLowerCase()}@${datos.domicilio}`,
      activa: true,
      registroCompleto: true,
      estadoCace: 'APROBADA',
    },
  });

  const passwordHash = await bcrypt.hash(PASSWORD_PRUEBA, 4);
  const sufijo = datos.sufijo;

  const usuarioAgente = await prisma.usuario.create({
    data: {
      nombres: 'Agente',
      apellidoPaterno: `Institución ${sufijo}`,
      apellidoMaterno: 'Prueba',
      dni: `PRUE${sufijo}-AG`,
      tipoDocumento: 'PASAPORTE',
      correo: `agente.${sufijo.toLowerCase()}@${datos.domicilio}`,
      passwordHash,
    },
  });
  await prisma.agenteInternacionalizacion.create({
    data: {
      usuarioId: usuarioAgente.id,
      institucionId: institucion.id,
      cargo: 'Coordinador de Internacionalización',
      esPrincipal: true,
      confirmadoEn: new Date(),
    },
  });

  const usuarioDocente = await prisma.usuario.create({
    data: {
      nombres: 'Docente',
      apellidoPaterno: `Institución ${sufijo}`,
      apellidoMaterno: 'Prueba',
      dni: `PRUE${sufijo}-DO`,
      tipoDocumento: 'PASAPORTE',
      correo: `docente.${sufijo.toLowerCase()}@${datos.domicilio}`,
      passwordHash,
    },
  });
  const docente = await prisma.docente.create({
    data: {
      usuarioId: usuarioDocente.id,
      gradoAcademico: 'Maestría',
      especialidad: 'Educación',
    },
  });
  const docenteInstitucion = await prisma.docenteInstitucion.create({
    data: {
      docenteId: docente.id,
      institucionId: institucion.id,
      numeroEmpleado: `DOC-${sufijo}-001`,
      activo: true,
    },
  });
  const materia = await prisma.materia.create({
    data: {
      institucionId: institucion.id,
      clave: `PRU-${sufijo}-101`,
      nombre: `Materia de prueba ${sufijo}`,
      programaEducativo: 'Educación',
      descripcion: 'Materia de la institución extra',
      activa: true,
    },
  });
  const asignacion = await prisma.asignacionDocente.create({
    data: {
      docenteInstitucionId: docenteInstitucion.id,
      materiaId: materia.id,
      periodoEscolar: '2026-2027',
    },
  });

  return {
    institucionId: institucion.id,
    asignacionId: asignacion.id,
    correoAgente: usuarioAgente.correo,
    correoDocente: usuarioDocente.correo,
  };
}

describe('Clase espejo con cuatro instituciones (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let proyectoId = 0;
  let sesionId = 0;
  let reporteId = 0;
  let extraC: InstitucionExtra;
  let extraD: InstitucionExtra;
  let extraE: InstitucionExtra;
  let docentes: DocenteDeLaClase[] = [];
  let tokenAgenteC = '';
  let tokenAgenteD = '';

  const listas: Record<string, number[]> = {};

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);

    extraC = await crearInstitucionExtra(prisma, {
      nombre: 'Institución de Prueba Sevilla',
      pais: 'España',
      codigoPais: 'ES',
      provincia: 'Andalucía',
      ciudad: 'Sevilla',
      sufijo: 'C',
      domicilio: 'prueba.es',
    });
    extraD = await crearInstitucionExtra(prisma, {
      nombre: 'Institución de Prueba Buenos Aires',
      pais: 'Argentina',
      codigoPais: 'AR',
      provincia: 'Buenos Aires',
      ciudad: 'La Plata',
      sufijo: 'D',
      domicilio: 'prueba.ar',
    });
    extraE = await crearInstitucionExtra(prisma, {
      nombre: 'Institución de Prueba Ajena',
      pais: 'México',
      codigoPais: 'MX',
      provincia: 'Campeche',
      ciudad: 'Calkiní',
      sufijo: 'E',
      domicilio: 'prueba.mx',
    });

    const proyecto = await crearProyectoDePrueba(prisma, semilla, {
      conSesion: true,
    });
    proyectoId = proyecto.proyectoId;
    sesionId = proyecto.sesionId ?? 0;
    await crearPlantillaDePrueba(prisma, semilla.usuarioPresidencia);

    const [tokenA, tokenB, tokenC, tokenD] = await Promise.all([
      iniciarSesion(app, semilla.correos.docenteA),
      iniciarSesion(app, semilla.correos.docenteB),
      iniciarSesion(app, extraC.correoDocente),
      iniciarSesion(app, extraD.correoDocente),
    ]);
    tokenAgenteC = await iniciarSesion(app, extraC.correoAgente);
    tokenAgenteD = await iniciarSesion(app, extraD.correoAgente);

    docentes = [
      { sufijo: 'A', institucionId: semilla.institucionAId, token: tokenA },
      { sufijo: 'B', institucionId: semilla.institucionBId, token: tokenB },
      { sufijo: 'C', institucionId: extraC.institucionId, token: tokenC },
      { sufijo: 'D', institucionId: extraD.institucionId, token: tokenD },
    ];
  });

  afterAll(async () => {
    // La emisión deja los PDF en uploads/certificados; la prueba no debe
    // acumular basura si se ejecuta muchas veces.
    const certificados = await prisma.certificado.findMany({
      where: { proyectoId },
      select: { archivoPdf: true },
    });
    for (const certificado of certificados) {
      try {
        unlinkSync(
          join(
            process.cwd(),
            'uploads',
            'certificados',
            certificado.archivoPdf,
          ),
        );
      } catch {
        // Si el archivo ya no existe, no hay nada que limpiar.
      }
    }
    await app.close();
  });

  it('1. la clase arranca con las dos instituciones de la solicitud', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/participantes`)
      .set(autenticado(docentes[0].token))
      .expect(200);

    const filas = respuesta.body as Array<{
      institucionId: number;
      rol: string;
      estado: string;
    }>;
    expect(filas).toHaveLength(2);
    expect(filas.map((fila) => fila.rol).sort()).toEqual(['DESTINO', 'ORIGEN']);
    expect(filas.every((fila) => fila.estado === 'APROBADA')).toBe(true);
  });

  it('2. la tercera y la cuarta institución se invitan y aprueban por su agente', async () => {
    const invitaciones = [
      {
        extra: extraC,
        tokenAgente: tokenAgenteC,
        tokenDocente: docentes[2].token,
      },
      {
        extra: extraD,
        tokenAgente: tokenAgenteD,
        tokenDocente: docentes[3].token,
      },
    ];

    for (const { extra, tokenAgente, tokenDocente } of invitaciones) {
      const invitacion = await request(app.getHttpServer())
        .post(`/proyectos/${proyectoId}/participantes`)
        .set(autenticado(docentes[0].token))
        .send({ institucionId: extra.institucionId })
        .expect(201);

      expect(invitacion.body.estado).toBe('PENDIENTE');
      expect(invitacion.body.rol).toBe('COLABORADORA');

      // El agente ve la clase desde que se le invita (así encuentra la
      // invitación pendiente); el docente de esa institución todavía no.
      await request(app.getHttpServer())
        .get(`/proyectos/${proyectoId}`)
        .set(autenticado(tokenAgente))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/proyectos/${proyectoId}`)
        .set(autenticado(tokenDocente))
        .expect((respuesta) => {
          expect([403, 404]).toContain(respuesta.status);
        });

      const decision = await request(app.getHttpServer())
        .post(
          `/proyectos/${proyectoId}/participantes/${invitacion.body.id}/decidir`,
        )
        .set(autenticado(tokenAgente))
        .send({
          decision: 'APROBADA',
          asignacionDocenteId: extra.asignacionId,
        })
        .expect(201);

      expect(decision.body.estado).toBe('APROBADA');
    }

    const participantes = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/participantes`)
      .set(autenticado(docentes[0].token))
      .expect(200);

    const filas = participantes.body as Array<{
      institucionId: number;
      rol: string;
      estado: string;
      docente: { nombre: string } | null;
    }>;
    expect(filas).toHaveLength(4);
    expect(filas.filter((fila) => fila.rol === 'COLABORADORA')).toHaveLength(2);
    expect(filas.every((fila) => fila.estado === 'APROBADA')).toBe(true);
    expect(filas.every((fila) => fila.docente !== null)).toBe(true);
    expect(new Set(filas.map((fila) => fila.institucionId)).size).toBe(4);

    // Los cuatro docentes entran a la clase.
    for (const docente of docentes) {
      await request(app.getHttpServer())
        .get(`/proyectos/${proyectoId}`)
        .set(autenticado(docente.token))
        .expect(200);
    }
  });

  it('3. cada docente sube la lista de su institución', async () => {
    for (const docente of docentes) {
      const respuesta = await request(app.getHttpServer())
        .put(`/proyectos/${proyectoId}/listas-alumnos`)
        .set(autenticado(docente.token))
        .send({
          origen: 'PEGADO',
          alumnos: [
            {
              nombre: `Alumno ${docente.sufijo} Uno`,
              matricula: `${docente.sufijo}-001`,
              correo: `alumno.${docente.sufijo.toLowerCase()}.uno@prueba.mx`,
            },
            {
              nombre: `Alumno ${docente.sufijo} Dos`,
              matricula: `${docente.sufijo}-002`,
              correo: `alumno.${docente.sufijo.toLowerCase()}.dos@prueba.mx`,
            },
          ],
          declaraConsentimiento: true,
        })
        .expect(200);

      const alumnos = respuesta.body.alumnos as Array<{ id: number }>;
      expect(alumnos).toHaveLength(2);
      listas[docente.sufijo] = alumnos.map((alumno) => alumno.id);
    }

    const enBase = await prisma.listaAlumnos.findMany({
      where: { proyectoId },
      select: { institucionId: true },
    });
    expect(enBase).toHaveLength(4);
    expect(new Set(enBase.map((lista) => lista.institucionId)).size).toBe(4);
  });

  it('4. el reporte de la sesión necesita las cuatro firmas', async () => {
    const reporte = await request(app.getHttpServer())
      .put(`/proyectos/${proyectoId}/sesiones/${sesionId}/reporte`)
      .set(autenticado(docentes[0].token))
      .send({
        desarrolloClase:
          'La sesión se desarrolló con las cuatro instituciones conectadas.',
        totalAsistentes: 80,
        incidencias: 'Ninguna',
        acuerdosSiguienteSesion: 'Entregar la actividad final.',
      })
      .expect(200);

    reporteId = reporte.body.id;
    expect(reporte.body.estado).toBe('BORRADOR');

    // Las tres primeras firmas dejan el reporte en revisión: faltan docentes.
    const estadosEsperados = [
      'EN_REVISION',
      'EN_REVISION',
      'EN_REVISION',
      'CONFIRMADO',
    ];
    for (const [indice, docente] of docentes.entries()) {
      const firma = await request(app.getHttpServer())
        .post(`/proyectos/${proyectoId}/reportes-clase/${reporteId}/confirmar`)
        .set(autenticado(docente.token))
        .send({ observaciones: `Conforme (docente ${docente.sufijo})` })
        .expect(201);

      expect(firma.body.estado).toBe(estadosEsperados[indice]);
    }

    const enBase = await prisma.reporteClaseConjunta.findUniqueOrThrow({
      where: { id: reporteId },
      select: { estado: true },
    });
    expect(enBase.estado).toBe('CONFIRMADO');
  });

  it('5. el cierre deja la clase FINALIZADA y congela las cuatro participaciones', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/evaluaciones`)
      .set(autenticado(docentes[0].token))
      .send({
        instrumento: 'Rúbrica de la clase espejo',
        resultado: 'Satisfactorio',
        observaciones: 'Las cuatro instituciones cumplieron los objetivos',
      })
      .expect(201);

    const cierre = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/cerrar`)
      .set(autenticado(docentes[0].token))
      .expect(201);
    expect(cierre.body.estado).toBe('FINALIZADO');

    const participantes = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/participantes`)
      .set(autenticado(docentes[0].token))
      .expect(200);

    const filas = participantes.body as Array<{ estado: string }>;
    expect(filas).toHaveLength(4);
    expect(filas.every((fila) => fila.estado === 'CONGELADA')).toBe(true);
  });

  it('6. cada institución emite los certificados de sus propios alumnos', async () => {
    const folios: string[] = [];

    for (const docente of docentes) {
      const emision = await request(app.getHttpServer())
        .post(`/proyectos/${proyectoId}/certificados/emitir`)
        .set(autenticado(docente.token))
        .send({})
        .expect(201);

      const emitidos = emision.body.emitidos as Array<{
        folio: string;
        alumno: { nombre: string };
      }>;
      expect(emitidos).toHaveLength(2);
      for (const emitido of emitidos) {
        expect(emitido.folio).toMatch(/^CACE-\d{4}-\d{4}-[A-Z2-9]{8}$/);
        folios.push(emitido.folio);
      }
    }

    expect(new Set(folios).size).toBe(8);

    const enBase = await prisma.certificado.findMany({
      where: { proyectoId },
      select: {
        folio: true,
        alumnoId: true,
        institucionesSnapshot: true,
        alumno: { select: { lista: { select: { institucionId: true } } } },
      },
    });
    expect(enBase).toHaveLength(8);
    expect(enBase[0].institucionesSnapshot).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nombre: expect.any(String) }),
      ]),
    );
    expect(
      Array.isArray(enBase[0].institucionesSnapshot)
        ? enBase[0].institucionesSnapshot.length
        : 0,
    ).toBe(4);

    const porInstitucion = new Map<number, number>();
    for (const certificado of enBase) {
      const institucionId = certificado.alumno.lista.institucionId;
      porInstitucion.set(
        institucionId,
        (porInstitucion.get(institucionId) ?? 0) + 1,
      );
    }
    for (const docente of docentes) {
      expect(porInstitucion.get(docente.institucionId)).toBe(2);
    }

    // Cada certificado salió de la lista de su institución: sus alumnos son los
    // que esa institución había subido, no los de otra.
    for (const docente of docentes) {
      const institucionId = docente.institucionId;
      const emitidosDeLaInstitucion = enBase.filter(
        (certificado) =>
          certificado.alumno.lista.institucionId === institucionId,
      );
      const alumnosEsperados = new Set(listas[docente.sufijo]);
      expect(
        emitidosDeLaInstitucion.every((certificado) =>
          alumnosEsperados.has(certificado.alumnoId),
        ),
      ).toBe(true);
    }
  });

  it('7. una institución no invitada no ve la clase ni puede emitir en ella', async () => {
    const tokenAjeno = await iniciarSesion(app, extraE.correoDocente);

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}`)
      .set(autenticado(tokenAjeno))
      .expect((respuesta) => {
        expect([403, 404]).toContain(respuesta.status);
      });

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/participantes`)
      .set(autenticado(tokenAjeno))
      .expect((respuesta) => {
        expect([403, 404]).toContain(respuesta.status);
      });

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/certificados/emitir`)
      .set(autenticado(tokenAjeno))
      .send({})
      .expect(403);
  });
});
