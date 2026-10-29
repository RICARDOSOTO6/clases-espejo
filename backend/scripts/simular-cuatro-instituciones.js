/**
 * Simulación de una clase espejo con cuatro instituciones.
 *
 * Añade dos instituciones nuevas a la base de demostración y crea una clase
 * espejo con las dos instituciones originales (Calkiní y Colombia) más las dos
 * nuevas (Sevilla y Buenos Aires). No borra ni modifica las clases existentes.
 *
 * Uso, desde backend:
 *   node scripts/simular-cuatro-instituciones.js
 *
 * Credenciales nuevas:
 *   agente.sevilla@clasesespejo.es / Demo1234
 *   docente.sevilla@clasesespejo.es / Demo1234
 *   agente.uba@clasesespejo.ar / Demo1234
 *   docente.uba@clasesespejo.ar / Demo1234
 */
require('dotenv').config();
const { PrismaClient } = require('../dist/generated/prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const PASSWORD = 'Demo1234';

async function buscarInstitucion(nombre) {
  const institucion = await prisma.institucion.findFirst({ where: { nombre } });
  if (!institucion) {
    throw new Error(`No existe la institución base: ${nombre}`);
  }
  return institucion;
}

async function crearInstitucion(datos) {
  const existente = await prisma.institucion.findFirst({
    where: { correoInstitucional: datos.correoInstitucional },
  });
  if (existente) return existente;
  return prisma.institucion.create({
    data: {
      ...datos,
      activa: true,
      registroCompleto: true,
      estadoCace: 'APROBADA',
    },
  });
}

async function crearUsuarioConRol(datos, institucionId, rol) {
  const existente = await prisma.usuario.findUnique({
    where: { correo: datos.correo },
  });
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const usuario =
    existente ??
    (await prisma.usuario.create({
      data: {
        nombres: datos.nombres,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: datos.apellidoMaterno,
        tipoDocumento: datos.tipoDocumento,
        dni: datos.dni,
        correo: datos.correo,
        passwordHash,
        activo: true,
      },
    }));

  if (rol === 'AGENTE') {
    const agente = await prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId: usuario.id },
    });
    if (!agente) {
      await prisma.agenteInternacionalizacion.create({
        data: {
          usuarioId: usuario.id,
          institucionId,
          cargo: datos.cargo,
          esPrincipal: true,
          confirmadoEn: new Date(),
        },
      });
    }
    return { usuario, docenteInstitucion: null };
  }

  let docente = await prisma.docente.findUnique({
    where: { usuarioId: usuario.id },
  });
  if (!docente) {
    docente = await prisma.docente.create({
      data: {
        usuarioId: usuario.id,
        gradoAcademico: 'Maestría',
        especialidad: datos.especialidad,
      },
    });
  }
  let docenteInstitucion = await prisma.docenteInstitucion.findUnique({
    where: {
      docenteId_institucionId: {
        docenteId: docente.id,
        institucionId,
      },
    },
  });
  if (!docenteInstitucion) {
    docenteInstitucion = await prisma.docenteInstitucion.create({
      data: {
        docenteId: docente.id,
        institucionId,
        numeroEmpleado: datos.numeroEmpleado,
        activo: true,
      },
    });
  }
  return { usuario, docente, docenteInstitucion };
}

async function crearMateriaYAsignacion(institucionId, docenteInstitucionId, datos) {
  let materia = await prisma.materia.findFirst({
    where: { institucionId, clave: datos.clave },
  });
  if (!materia) {
    materia = await prisma.materia.create({
      data: {
        institucionId,
        clave: datos.clave,
        nombre: datos.nombre,
        programaEducativo: datos.programa,
        descripcion: datos.descripcion,
        activa: true,
      },
    });
  }
  let asignacion = await prisma.asignacionDocente.findFirst({
    where: {
      docenteInstitucionId,
      materiaId: materia.id,
      periodoEscolar: '2026-2027',
    },
  });
  if (!asignacion) {
    asignacion = await prisma.asignacionDocente.create({
      data: {
        docenteInstitucionId,
        materiaId: materia.id,
        periodoEscolar: '2026-2027',
      },
    });
  }
  return { materia, asignacion };
}

async function main() {
  const calkini = await buscarInstitucion('Instituto Tecnológico Superior de Calkiní');
  const colombia = await buscarInstitucion('Universidad Nacional de Colombia');

  const sevilla = await crearInstitucion({
    nombre: 'Universidad de Sevilla',
    pais: 'España',
    codigoPais: 'ES',
    estado: 'Sevilla',
    ciudad: 'Sevilla',
    telefono: '+34 954 55 10 00',
    correoInstitucional: 'contacto@sevilla.demo',
  });
  const buenosAires = await crearInstitucion({
    nombre: 'Universidad de Buenos Aires',
    pais: 'Argentina',
    codigoPais: 'AR',
    estado: 'Ciudad Autónoma de Buenos Aires',
    ciudad: 'Buenos Aires',
    telefono: '+54 11 5285 0000',
    correoInstitucional: 'contacto@uba.demo',
  });

  const agenteSevilla = await crearUsuarioConRol(
    {
      nombres: 'Carmen',
      apellidoPaterno: 'Ruiz',
      apellidoMaterno: 'Demo',
      tipoDocumento: 'PASAPORTE',
      dni: 'DEMO-ES-AG-01',
      correo: 'agente.sevilla@clasesespejo.es',
      cargo: 'Coordinadora de Internacionalización',
    },
    sevilla.id,
    'AGENTE',
  );
  const docenteSevilla = await crearUsuarioConRol(
    {
      nombres: 'Lucía',
      apellidoPaterno: 'Moreno',
      apellidoMaterno: 'Demo',
      tipoDocumento: 'PASAPORTE',
      dni: 'DEMO-ES-DO-01',
      correo: 'docente.sevilla@clasesespejo.es',
      especialidad: 'Ingeniería de Software',
      numeroEmpleado: 'USE-DEMO-01',
    },
    sevilla.id,
    'DOCENTE',
  );
  const agenteUba = await crearUsuarioConRol(
    {
      nombres: 'Martín',
      apellidoPaterno: 'Paz',
      apellidoMaterno: 'Demo',
      tipoDocumento: 'PASAPORTE',
      dni: 'DEMO-AR-AG-01',
      correo: 'agente.uba@clasesespejo.ar',
      cargo: 'Coordinador de Internacionalización',
    },
    buenosAires.id,
    'AGENTE',
  );
  const docenteUba = await crearUsuarioConRol(
    {
      nombres: 'Tomás',
      apellidoPaterno: 'Silva',
      apellidoMaterno: 'Demo',
      tipoDocumento: 'PASAPORTE',
      dni: 'DEMO-AR-DO-01',
      correo: 'docente.uba@clasesespejo.ar',
      especialidad: 'Ciencia de Datos',
      numeroEmpleado: 'UBA-DEMO-01',
    },
    buenosAires.id,
    'DOCENTE',
  );

  const materiaSevilla = await crearMateriaYAsignacion(
    sevilla.id,
    docenteSevilla.docenteInstitucion.id,
    {
      clave: 'USE-DEMO-101',
      nombre: 'Ingeniería de Software Sostenible',
      programa: 'Ingeniería Informática',
      descripcion: 'Materia de demostración de la Universidad de Sevilla',
    },
  );
  const materiaUba = await crearMateriaYAsignacion(
    buenosAires.id,
    docenteUba.docenteInstitucion.id,
    {
      clave: 'UBA-DEMO-101',
      nombre: 'Datos para la Innovación',
      programa: 'Ciencia de Datos',
      descripcion: 'Materia de demostración de la Universidad de Buenos Aires',
    },
  );

  const asignacionCalkini = await prisma.asignacionDocente.findFirst({
    where: { docenteInstitucion: { institucionId: calkini.id } },
  });
  const asignacionColombia = await prisma.asignacionDocente.findFirst({
    where: { docenteInstitucion: { institucionId: colombia.id } },
  });
  if (!asignacionCalkini || !asignacionColombia) {
    throw new Error('Las instituciones base no tienen asignaciones para la clase');
  }

  const titulo = 'Clase espejo de cuatro instituciones: Innovación y sostenibilidad';
  let solicitud = await prisma.solicitudClaseEspejo.findFirst({
    where: { titulo },
  });
  if (!solicitud) {
    const fecha = new Date();
    fecha.setUTCDate(fecha.getUTCDate() + 35);
    solicitud = await prisma.solicitudClaseEspejo.create({
      data: {
        asignacionOrigenId: asignacionCalkini.id,
        asignacionDestinoId: asignacionColombia.id,
        institucionDestinoId: colombia.id,
        materiaDestinoId: materiaUba.materia.id,
        titulo,
        objetivo:
          'Demostrar una clase espejo con cuatro instituciones y observación de una quinta.',
        fechaPropuesta: fecha,
        estado: 'APROBADA',
      },
    });
  }

  let proyecto = await prisma.proyectoClaseEspejo.findUnique({
    where: { solicitudId: solicitud.id },
  });
  if (!proyecto) {
    const inicio = new Date(solicitud.fechaPropuesta);
    const fin = new Date(inicio);
    fin.setUTCDate(fin.getUTCDate() + 14);
    proyecto = await prisma.proyectoClaseEspejo.create({
      data: {
        solicitudId: solicitud.id,
        estado: 'EN_PLANIFICACION',
        fechaInicio: inicio,
        fechaFin: fin,
        plataforma: 'Zoom',
      },
    });
  }

  const docentes = [
    { asignacionDocenteId: asignacionCalkini.id, rol: 'ORIGEN' },
    { asignacionDocenteId: asignacionColombia.id, rol: 'DESTINO' },
    { asignacionDocenteId: materiaSevilla.asignacion.id, rol: 'COLABORADORA' },
    { asignacionDocenteId: materiaUba.asignacion.id, rol: 'COLABORADORA' },
  ];
  for (const docente of docentes) {
    const existe = await prisma.proyectoDocente.findFirst({
      where: {
        proyectoId: proyecto.id,
        asignacionDocenteId: docente.asignacionDocenteId,
      },
    });
    if (!existe) {
      await prisma.proyectoDocente.create({
        data: { proyectoId: proyecto.id, ...docente },
      });
    }
  }

  const participantes = [
    {
      institucionId: calkini.id,
      docenteInstitucionId: asignacionCalkini.docenteInstitucionId,
      rol: 'ORIGEN',
    },
    {
      institucionId: colombia.id,
      docenteInstitucionId: asignacionColombia.docenteInstitucionId,
      rol: 'DESTINO',
    },
    {
      institucionId: sevilla.id,
      docenteInstitucionId: docenteSevilla.docenteInstitucion.id,
      rol: 'COLABORADORA',
    },
    {
      institucionId: buenosAires.id,
      docenteInstitucionId: docenteUba.docenteInstitucion.id,
      rol: 'COLABORADORA',
    },
  ];
  for (const participante of participantes) {
    await prisma.proyectoParticipante.upsert({
      where: {
        proyectoId_institucionId: {
          proyectoId: proyecto.id,
          institucionId: participante.institucionId,
        },
      },
      create: {
        proyectoId: proyecto.id,
        ...participante,
        estado: 'APROBADA',
      },
      update: {
        rol: participante.rol,
        estado: 'APROBADA',
        docenteInstitucionId: participante.docenteInstitucionId,
      },
    });
  }

  const sesionExistente = await prisma.sesion.findFirst({
    where: { proyectoId: proyecto.id },
  });
  if (!sesionExistente) {
    await prisma.sesion.create({
      data: {
        proyectoId: proyecto.id,
        titulo: 'Sesión inaugural de las cuatro instituciones',
        fechaHora: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        enlaceVirtual: 'https://meet.example.com/cuatro-instituciones',
        estado: 'PROGRAMADA',
      },
    });
  }

  console.log('Simulación lista.');
  console.log(`Proyecto: ${proyecto.id} — ${titulo}`);
  console.log('Instituciones: Calkiní, Colombia, Sevilla y Buenos Aires');
  console.log('Agentes nuevos:');
  console.log('  agente.sevilla@clasesespejo.es / Demo1234');
  console.log('  agente.uba@clasesespejo.ar / Demo1234');
  console.log('Docentes nuevos:');
  console.log('  docente.sevilla@clasesespejo.es / Demo1234');
  console.log('  docente.uba@clasesespejo.ar / Demo1234');
  console.log('Docente de la clase (Calkiní): sofia.gomez@clasesespejo.mx / Demo1234');
  console.log('Abre /proyectos/' + proyecto.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
