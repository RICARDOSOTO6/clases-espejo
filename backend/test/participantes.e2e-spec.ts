import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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

jest.setTimeout(60000);

describe('Multi-institución y observadores (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let proyectoId = 0;
  let proyectoFinalId = 0;
  let proyectoCertificadoCId = 0;
  let institucionCId = 0;
  let asignacionCId = 0;
  let usuarioDocenteCId = 0;
  let correoAgenteC = '';
  let correoDocenteC = '';
  let tokenDocenteA = '';
  let tokenAgenteA = '';
  let tokenAgenteC = '';
  let tokenDocenteC = '';

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);

    const proyecto = await crearProyectoDePrueba(prisma, semilla);
    proyectoId = proyecto.proyectoId;
    const proyectoFinal = await crearProyectoDePrueba(prisma, semilla, {
      estado: 'FINALIZADO',
    });
    proyectoFinalId = proyectoFinal.proyectoId;

    // Tercera institución con agente y docente propios.
    const institucion = await prisma.institucion.create({
      data: {
        nombre: 'Institución de Prueba C',
        pais: 'México',
        codigoPais: 'MX',
        estado: 'Campeche',
        ciudad: 'San Francisco de Campeche',
        telefono: '+52 981 111 1111',
        correoInstitucional: 'contacto@c.prueba',
        activa: true,
        registroCompleto: true,
        estadoCace: 'APROBADA',
      },
    });
    institucionCId = institucion.id;

    const usuarioAgenteC = await prisma.usuario.create({
      data: {
        nombres: 'Agente',
        apellidoPaterno: 'Gamma',
        apellidoMaterno: 'Prueba',
        dni: 'PRUED003',
        tipoDocumento: 'DNI',
        correo: 'agente.c@prueba.mx',
        passwordHash: await bcrypt.hash(PASSWORD_PRUEBA, 4),
      },
    });
    correoAgenteC = usuarioAgenteC.correo;
    await prisma.agenteInternacionalizacion.create({
      data: {
        usuarioId: usuarioAgenteC.id,
        institucionId: institucion.id,
        cargo: 'Coordinador de Internacionalización',
        esPrincipal: true,
        confirmadoEn: new Date(),
      },
    });

    const usuarioDocenteC = await prisma.usuario.create({
      data: {
        nombres: 'Docente',
        apellidoPaterno: 'Delta',
        apellidoMaterno: 'Prueba',
        dni: 'PRUED004',
        tipoDocumento: 'DNI',
        correo: 'docente.c2@prueba.mx',
        passwordHash: await bcrypt.hash(PASSWORD_PRUEBA, 4),
      },
    });
    correoDocenteC = usuarioDocenteC.correo;
    const docenteC = await prisma.docente.create({
      data: {
        usuarioId: usuarioDocenteC.id,
        gradoAcademico: 'Maestría',
        especialidad: 'Educación',
      },
    });
    const docenteInstitucionC = await prisma.docenteInstitucion.create({
      data: {
        docenteId: docenteC.id,
        institucionId: institucion.id,
        numeroEmpleado: 'DOC-C-001',
        activo: true,
      },
    });
    const materiaC = await prisma.materia.create({
      data: {
        institucionId: institucion.id,
        clave: 'PRU-C-101',
        nombre: 'Materia de prueba C',
        programaEducativo: 'Educación',
        descripcion: 'Materia de la tercera institución',
        activa: true,
      },
    });
    const asignacionC = await prisma.asignacionDocente.create({
      data: {
        docenteInstitucionId: docenteInstitucionC.id,
        materiaId: materiaC.id,
        periodoEscolar: '2026-2027',
      },
    });
    asignacionCId = asignacionC.id;
    usuarioDocenteCId = usuarioDocenteC.id;

    // Proyecto cerrado con la institución C como participante plena y lista
    // propia, para comprobar que los certificados no asumen solo dos partes.
    const proyectoCertificado = await crearProyectoDePrueba(prisma, semilla, {
      estado: 'FINALIZADO',
    });
    proyectoCertificadoCId = proyectoCertificado.proyectoId;
    await prisma.proyectoDocente.create({
      data: {
        proyectoId: proyectoCertificadoCId,
        asignacionDocenteId: asignacionCId,
        rol: 'COLABORADORA',
      },
    });
    await prisma.proyectoParticipante.create({
      data: {
        proyectoId: proyectoCertificadoCId,
        institucionId: institucionCId,
        docenteInstitucionId: docenteInstitucionC.id,
        rol: 'COLABORADORA',
        estado: 'APROBADA',
      },
    });
    await prisma.listaAlumnos.create({
      data: {
        proyectoId: proyectoCertificadoCId,
        institucionId: institucionCId,
        subidaPorUsuarioId: usuarioDocenteCId,
        origen: 'PEGADO',
        consentimientoVersion: '2026-10-25',
        consentimientoEn: new Date(),
        alumnos: {
          create: [
            {
              nombre: 'Alumna de la institución C',
              matricula: 'C-001',
              correo: 'alumna.c@prueba.mx',
              orden: 1,
              incluido: true,
            },
          ],
        },
      },
    });
    await crearPlantillaDePrueba(prisma, semilla.usuarioPresidencia);

    tokenDocenteA = await iniciarSesion(app, semilla.correos.docenteA);
    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
    tokenAgenteC = await iniciarSesion(app, correoAgenteC);
    tokenDocenteC = await iniciarSesion(app, correoDocenteC);
  });

  afterAll(async () => {
    await app.close();
  });

  it('no permite retirar al único docente de una de las dos instituciones', async () => {
    const docentes = await prisma.proyectoDocente.findMany({
      where: { proyectoId },
      orderBy: { id: 'asc' },
    });
    await request(app.getHttpServer())
      .delete(`/proyectos/${proyectoId}/docentes/${docentes[0].id}`)
      .set(autenticado(tokenAgenteA))
      .expect(400);
  });

  it('permite invitar, aprobar y usar una tercera institución participante', async () => {
    const invitacion = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/participantes`)
      .set(autenticado(tokenDocenteA))
      .send({ institucionId: institucionCId })
      .expect(201);

    expect(invitacion.body.estado).toBe('PENDIENTE');
    expect(invitacion.body.rol).toBe('COLABORADORA');

    const pendientes = await request(app.getHttpServer())
      .get('/participaciones/pendientes')
      .set(autenticado(tokenAgenteC))
      .expect(200);
    expect(pendientes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participanteId: invitacion.body.id,
          proyectoId,
        }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}`)
      .set(autenticado(tokenAgenteC))
      .expect(200);

    const decision = await request(app.getHttpServer())
      .post(
        `/proyectos/${proyectoId}/participantes/${invitacion.body.id}/decidir`,
      )
      .set(autenticado(tokenAgenteC))
      .send({ decision: 'APROBADA', asignacionDocenteId: asignacionCId })
      .expect(201);

    expect(decision.body.estado).toBe('APROBADA');

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}`)
      .set(autenticado(tokenDocenteC))
      .expect(200);

    const lista = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/participantes`)
      .set(autenticado(tokenDocenteC))
      .expect(200);
    expect(lista.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          institucionId: institucionCId,
          rol: 'COLABORADORA',
        }),
      ]),
    );
  });

  it('congela las participaciones al cerrar la clase', async () => {
    const paraCerrar = await crearProyectoDePrueba(prisma, semilla, {
      conSesion: true,
    });
    await prisma.evaluacion.create({
      data: {
        proyectoId: paraCerrar.proyectoId,
        instrumento: 'Rúbrica',
        resultado: 'Satisfactorio',
        observaciones: 'Evaluación de prueba',
      },
    });
    await prisma.reporteClaseConjunta.create({
      data: {
        sesionId: paraCerrar.sesionId!,
        desarrolloClase: 'Desarrollo completo',
        totalAsistentes: 10,
        incidencias: '',
        acuerdosSiguienteSesion: 'Continuar',
        estado: 'CONFIRMADO',
      },
    });

    await request(app.getHttpServer())
      .post(`/proyectos/${paraCerrar.proyectoId}/cerrar`)
      .set(autenticado(tokenDocenteA))
      .expect(201);

    const participantes = await prisma.proyectoParticipante.findMany({
      where: { proyectoId: paraCerrar.proyectoId },
      select: { estado: true },
    });
    expect(participantes.length).toBeGreaterThanOrEqual(2);
    expect(
      participantes.every(
        (participante) => participante.estado === 'CONGELADA',
      ),
    ).toBe(true);
  });

  it('rechaza una invitación sin quitar a las dos instituciones originales', async () => {
    const institucionD = await prisma.institucion.create({
      data: {
        nombre: 'Institución de Prueba D',
        pais: 'México',
        codigoPais: 'MX',
        estado: 'Campeche',
        ciudad: 'Campeche',
        telefono: '+52 981 222 2222',
        correoInstitucional: 'contacto@d.prueba',
        activa: true,
        registroCompleto: true,
        estadoCace: 'APROBADA',
      },
    });
    const usuarioAgenteD = await prisma.usuario.create({
      data: {
        nombres: 'Agente',
        apellidoPaterno: 'Épsilon',
        apellidoMaterno: 'Prueba',
        dni: 'PRUED005',
        tipoDocumento: 'DNI',
        correo: 'agente.d@prueba.mx',
        passwordHash: await bcrypt.hash(PASSWORD_PRUEBA, 4),
      },
    });
    await prisma.agenteInternacionalizacion.create({
      data: {
        usuarioId: usuarioAgenteD.id,
        institucionId: institucionD.id,
        cargo: 'Coordinador',
        esPrincipal: true,
        confirmadoEn: new Date(),
      },
    });
    const tokenAgenteD = await iniciarSesion(app, usuarioAgenteD.correo);

    const invitacion = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/participantes`)
      .set(autenticado(tokenDocenteA))
      .send({ institucionId: institucionD.id })
      .expect(201);

    const decision = await request(app.getHttpServer())
      .post(
        `/proyectos/${proyectoId}/participantes/${invitacion.body.id}/decidir`,
      )
      .set(autenticado(tokenAgenteD))
      .send({ decision: 'RECHAZADA', motivo: 'Sin disponibilidad' })
      .expect(201);
    expect(decision.body.estado).toBe('RECHAZADA');

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}`)
      .set(autenticado(tokenDocenteA))
      .expect(200);
  });

  it('permite que una tercera institución emita certificados de su propia lista', async () => {
    const estado = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoCertificadoCId}/certificados`)
      .set(autenticado(tokenDocenteC))
      .expect(200);
    expect(estado.body.claseCerrada).toBe(true);
    expect(estado.body.motivoNoEmitir).toBeNull();

    const emision = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoCertificadoCId}/certificados/emitir`)
      .set(autenticado(tokenDocenteC))
      .send({})
      .expect(201);

    expect(emision.body.emitidos).toHaveLength(1);
    expect(emision.body.emitidos[0].folio).toContain('CACE');
  });

  it('después del cierre solo permite observadoras de lectura y sin certificados', async () => {
    const observador = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoFinalId}/observadores`)
      .set(autenticado(tokenDocenteA))
      .send({ institucionId: institucionCId })
      .expect(201);
    expect(observador.body.rol).toBe('OBSERVADORA');

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoFinalId}`)
      .set(autenticado(tokenDocenteC))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoFinalId}/sesiones`)
      .set(autenticado(tokenDocenteC))
      .send({
        titulo: 'Intento de observadora',
        fechaHora: new Date(Date.now() + 86400000).toISOString(),
        enlaceVirtual: 'https://meet.example.com/observadora',
      })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoFinalId}/certificados`)
      .set(autenticado(tokenDocenteC))
      .expect(403);
  });
});
