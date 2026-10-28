import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  autenticado,
  crearAppE2E,
  crearProyectoDePrueba,
  iniciarSesion,
  limpiarBase,
  PASSWORD_PRUEBA,
  sembrarBase,
  type AppE2E,
  type ProyectoPrueba,
  type Semilla,
} from './base-e2e';
import type { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('Aislamiento institucional (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let semilla: Semilla;
  let proyectoAB: ProyectoPrueba;
  let proyectoBCId: number;
  let sesionBCId: number;
  let docenteInstitucionBId: number;
  let tokenDocenteA = '';
  let tokenAgenteA = '';
  let tokenSecretaria = '';
  let correoDocenteC = '';

  beforeAll(async () => {
    const e2e: AppE2E = await crearAppE2E();
    app = e2e.app;
    prisma = e2e.prisma;
    await limpiarBase(prisma);
    semilla = await sembrarBase(prisma);
    proyectoAB = await crearProyectoDePrueba(prisma, semilla);

    // Tercera institución: no participa en la clase A-B. Sirve para demostrar
    // que una persona de fuera no puede abrir recursos ajenos cambiando el id.
    const institucionC = await prisma.institucion.create({
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
    const usuarioC = await prisma.usuario.create({
      data: {
        nombres: 'Docente',
        apellidoPaterno: 'Gamma',
        apellidoMaterno: 'Prueba',
        dni: 'PRUED003',
        tipoDocumento: 'DNI',
        correo: 'docente.c@prueba.mx',
        passwordHash: await bcrypt.hash(PASSWORD_PRUEBA, 4),
      },
    });
    correoDocenteC = usuarioC.correo;
    const docenteC = await prisma.docente.create({
      data: {
        usuarioId: usuarioC.id,
        gradoAcademico: 'Maestría',
        especialidad: 'Educación',
      },
    });
    const docenteInstitucionC = await prisma.docenteInstitucion.create({
      data: {
        docenteId: docenteC.id,
        institucionId: institucionC.id,
        numeroEmpleado: 'DOC-C-001',
        activo: true,
      },
    });
    const materiaC = await prisma.materia.create({
      data: {
        institucionId: institucionC.id,
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

    const fechaInicio = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setUTCDate(fechaFin.getUTCDate() + 14);
    const solicitud = await prisma.solicitudClaseEspejo.create({
      data: {
        asignacionOrigenId: semilla.asignacionBId,
        asignacionDestinoId: asignacionC.id,
        institucionDestinoId: institucionC.id,
        materiaDestinoId: materiaC.id,
        titulo: 'Clase espejo B-C',
        objetivo: 'Probar aislamiento de una tercera institución',
        fechaPropuesta: fechaInicio,
        estado: 'APROBADA',
      },
    });
    const proyectoBC = await prisma.proyectoClaseEspejo.create({
      data: {
        solicitudId: solicitud.id,
        estado: 'EN_PLANIFICACION',
        fechaInicio,
        fechaFin,
        plataforma: 'Zoom',
      },
    });
    proyectoBCId = proyectoBC.id;
    const sesionBC = await prisma.sesion.create({
      data: {
        proyectoId: proyectoBC.id,
        titulo: 'Sesión privada B-C',
        fechaHora: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        enlaceVirtual: 'https://meet.example.com/privada-bc',
        estado: 'PROGRAMADA',
      },
    });
    const sesionBCIdCreada = sesionBC.id;
    sesionBCId = sesionBCIdCreada;
    await prisma.proyectoDocente.createMany({
      data: [
        {
          proyectoId: proyectoBC.id,
          asignacionDocenteId: semilla.asignacionBId,
          rol: 'ORIGEN',
        },
        {
          proyectoId: proyectoBC.id,
          asignacionDocenteId: asignacionC.id,
          rol: 'DESTINO',
        },
      ],
    });

    const docenteInstitucionB =
      await prisma.docenteInstitucion.findFirstOrThrow({
        where: { institucionId: semilla.institucionBId },
        select: { id: true },
      });
    docenteInstitucionBId = docenteInstitucionB.id;

    tokenDocenteA = await iniciarSesion(app, semilla.correos.docenteA);
    tokenAgenteA = await iniciarSesion(app, semilla.correos.agenteA);
    tokenSecretaria = await iniciarSesion(app, semilla.correos.secretaria);
  });

  afterAll(async () => {
    await app.close();
  });

  it('un agente no puede leer ni editar materias de otra institución', async () => {
    await request(app.getHttpServer())
      .get(`/materias/${semilla.materiaBId}`)
      .set(autenticado(tokenAgenteA))
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });

    await request(app.getHttpServer())
      .patch(`/materias/${semilla.materiaBId}`)
      .set(autenticado(tokenAgenteA))
      .send({ nombre: 'Materia alterada' })
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });
  });

  it('un agente no puede cambiar ni consultar docentes de otra institución', async () => {
    await request(app.getHttpServer())
      .patch(`/agentes/docentes/${docenteInstitucionBId}/estado`)
      .set(autenticado(tokenAgenteA))
      .send({ activo: false })
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });

    await request(app.getHttpServer())
      .get(`/agentes/docentes/${docenteInstitucionBId}/historial`)
      .set(autenticado(tokenAgenteA))
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });
  });

  it('un docente no puede leer una clase de otras instituciones', async () => {
    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}`)
      .set(autenticado(tokenDocenteA))
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
        expect(JSON.stringify(res.body)).not.toContain('Clase espejo B-C');
      });
  });

  it('un docente no puede leer evidencias ni listas de una clase ajena', async () => {
    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}/evidencias`)
      .set(autenticado(tokenDocenteA))
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}/listas-alumnos`)
      .set(autenticado(tokenDocenteA))
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });
  });

  it('un docente no puede leer ni modificar sesiones, reportes, evaluaciones ni mensajes ajenos', async () => {
    const negado = (res: { status: number }) => {
      expect([403, 404]).toContain(res.status);
    };

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}/sesiones`)
      .set(autenticado(tokenDocenteA))
      .expect(negado);

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoBCId}/sesiones`)
      .set(autenticado(tokenDocenteA))
      .send({
        titulo: 'Sesión intrusa',
        fechaHora: new Date(Date.now() + 86400000).toISOString(),
        enlaceVirtual: 'https://meet.example.com/intrusa',
      })
      .expect(negado);

    await request(app.getHttpServer())
      .patch(`/proyectos/${proyectoBCId}/sesiones/${sesionBCId}`)
      .set(autenticado(tokenDocenteA))
      .send({ titulo: 'Sesión alterada' })
      .expect(negado);

    await request(app.getHttpServer())
      .delete(`/proyectos/${proyectoBCId}/sesiones/${sesionBCId}`)
      .set(autenticado(tokenDocenteA))
      .expect(negado);

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}/reportes-clase`)
      .set(autenticado(tokenDocenteA))
      .expect(negado);

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}/sesiones/${sesionBCId}/reporte`)
      .set(autenticado(tokenDocenteA))
      .expect(negado);

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}/evaluaciones`)
      .set(autenticado(tokenDocenteA))
      .expect(negado);

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoBCId}/evaluaciones`)
      .set(autenticado(tokenDocenteA))
      .send({
        instrumento: 'Rúbrica',
        resultado: 'Satisfactorio',
        observaciones: 'Intento de otra institución',
      })
      .expect(negado);

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}/mensajes`)
      .set(autenticado(tokenDocenteA))
      .expect(negado);

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoBCId}/mensajes`)
      .set(autenticado(tokenDocenteA))
      .send({ contenido: 'Mensaje intruso' })
      .expect(negado);
  });

  it('un docente no puede leer la planificación ni los certificados de una clase ajena', async () => {
    const negado = (res: { status: number }) => {
      expect([403, 404]).toContain(res.status);
    };

    await request(app.getHttpServer())
      .put(`/proyectos/${proyectoBCId}/planificacion`)
      .set(autenticado(tokenDocenteA))
      .send({
        objetivosAcordados: 'Objetivo intruso',
        temasAcordados: 'Tema intruso',
        metodologia: 'Metodología intrusa',
        plataforma: 'Zoom',
      })
      .expect(negado);

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoBCId}/planificacion/confirmar`)
      .set(autenticado(tokenDocenteA))
      .expect(negado);

    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}/certificados`)
      .set(autenticado(tokenDocenteA))
      .expect(negado);

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoBCId}/certificados/emitir`)
      .set(autenticado(tokenDocenteA))
      .send({ alumnoId: 1 })
      .expect(negado);
  });

  it('la secretaría CACE no suplanta a un docente participante', async () => {
    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoAB.proyectoId}`)
      .set(autenticado(tokenSecretaria))
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });
  });

  it('la tercera institución sí puede entrar a su propia clase', async () => {
    const tokenDocenteC = await iniciarSesion(app, correoDocenteC);
    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoBCId}`)
      .set(autenticado(tokenDocenteC))
      .expect(200);
  });
});
