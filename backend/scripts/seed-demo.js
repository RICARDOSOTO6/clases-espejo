/**
 * Script de demostración: limpia la base de datos y siembra datos de ejemplo.
 * Uso:  node scripts/seed-demo.js   (desde la carpeta backend)
 */
require('dotenv').config();
const { PrismaClient } = require('../dist/generated/prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const PASSWORD = 'Demo1234';

// Orden de borrado (hijos antes que padres) por restricciones de FK.
const DELETE_ORDER = [
  'evaluacion',
  'evidencia',
  'participacionReporte',
  'reporteClaseConjunta',
  'actividad',
  'reportePlanificacion',
  'participacionPlanificacion',
  'planificacionConjunta',
  'proyectoDocente',
  'proyectoClaseEspejo',
  'revisionSolicitud',
  'solicitudClaseEspejo',
  'asignacionDocente',
  'docenteInstitucion',
  'materia',
  'invitacion',
  'agenteInternacionalizacion',
  'docente',
  'usuario',
  'institucion',
];

async function main() {
  console.log('🧹 Limpiando base de datos...');
  for (const model of DELETE_ORDER) {
    await prisma[model].deleteMany({});
  }

  console.log('🌱 Sembrando datos de demostración...');
  const hash = await bcrypt.hash(PASSWORD, 10);

  // ----- Instituciones -----
  const instA = await prisma.institucion.create({
    data: {
      nombre: 'Instituto Tecnológico Superior de Calkiní',
      pais: 'México',
      codigoPais: 'MX',
      estado: 'Campeche',
      ciudad: 'Calkiní',
      telefono: '+52 996 100 2000',
      correoInstitucional: 'contacto@itescam.edu.mx',
      activa: true,
      registroCompleto: true,
    },
  });

  const instB = await prisma.institucion.create({
    data: {
      nombre: 'Universidad Nacional de Colombia',
      pais: 'Colombia',
      codigoPais: 'CO',
      estado: 'Bogotá',
      ciudad: 'Bogotá',
      telefono: '+57 601 316 5000',
      correoInstitucional: 'contacto@unal.edu.co',
      activa: true,
      registroCompleto: true,
    },
  });

  // ----- Agentes (usuarios) -----
  const agenteA = await prisma.usuario.create({
    data: {
      nombres: 'María Fernanda',
      apellidoPaterno: 'López',
      apellidoMaterno: 'Hernández',
      tipoDocumento: 'DNI',
      dni: 'MFLH850101',
      correo: 'agente.calkini@clasesespejo.mx',
      passwordHash: hash,
      activo: true,
    },
  });
  await prisma.agenteInternacionalizacion.create({
    data: {
      usuarioId: agenteA.id,
      institucionId: instA.id,
      cargo: 'Coordinadora de Internacionalización',
    },
  });

  const agenteB = await prisma.usuario.create({
    data: {
      nombres: 'Juan Carlos',
      apellidoPaterno: 'Ramírez',
      apellidoMaterno: 'Torres',
      tipoDocumento: 'Cédula de identidad',
      dni: 'JCRT780310',
      correo: 'agente.colombia@clasesespejo.co',
      passwordHash: hash,
      activo: true,
    },
  });
  await prisma.agenteInternacionalizacion.create({
    data: {
      usuarioId: agenteB.id,
      institucionId: instB.id,
      cargo: 'Director de Internacionalización',
    },
  });

  // ----- Docentes (usuarios) -----
  const roberto = await prisma.usuario.create({
    data: {
      nombres: 'Roberto',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'Gutiérrez',
      tipoDocumento: 'DNI',
      dni: 'RPG900415',
      correo: 'roberto.perez@clasesespejo.mx',
      passwordHash: hash,
      activo: true,
    },
  });
  const docenteRoberto = await prisma.docente.create({
    data: {
      usuarioId: roberto.id,
      gradoAcademico: 'Maestría',
      especialidad: 'Ingeniería de Software',
    },
  });
  await prisma.docenteInstitucion.create({
    data: {
      docenteId: docenteRoberto.id,
      institucionId: instA.id,
      numeroEmpleado: 'D-1001',
      activo: true,
    },
  });

  const laura = await prisma.usuario.create({
    data: {
      nombres: 'Laura',
      apellidoPaterno: 'Martínez',
      apellidoMaterno: 'Cruz',
      tipoDocumento: 'DNI',
      dni: 'LMC930720',
      correo: 'laura.martinez@clasesespejo.mx',
      passwordHash: hash,
      activo: true,
    },
  });
  const docenteLaura = await prisma.docente.create({
    data: {
      usuarioId: laura.id,
      gradoAcademico: 'Licenciatura',
      especialidad: 'Contaduría',
    },
  });
  await prisma.docenteInstitucion.create({
    data: {
      docenteId: docenteLaura.id,
      institucionId: instA.id,
      numeroEmpleado: 'D-1002',
      activo: true,
    },
  });

  const andres = await prisma.usuario.create({
    data: {
      nombres: 'Andrés',
      apellidoPaterno: 'García',
      apellidoMaterno: 'Molina',
      tipoDocumento: 'Cédula de identidad',
      dni: 'AGM880520',
      correo: 'andres.garcia@clasesespejo.co',
      passwordHash: hash,
      activo: true,
    },
  });
  const docenteAndres = await prisma.docente.create({
    data: {
      usuarioId: andres.id,
      gradoAcademico: 'Doctorado',
      especialidad: 'Economía',
    },
  });
  await prisma.docenteInstitucion.create({
    data: {
      docenteId: docenteAndres.id,
      institucionId: instB.id,
      numeroEmpleado: 'D-2001',
      activo: true,
    },
  });

  const camila = await prisma.usuario.create({
    data: {
      nombres: 'Camila',
      apellidoPaterno: 'Rodríguez',
      apellidoMaterno: 'Salazar',
      tipoDocumento: 'Cédula de identidad',
      dni: 'CRS950815',
      correo: 'camila.rodriguez@clasesespejo.co',
      passwordHash: hash,
      activo: true,
    },
  });
  const docenteCamila = await prisma.docente.create({
    data: {
      usuarioId: camila.id,
      gradoAcademico: 'Maestría',
      especialidad: 'Desarrollo de Software',
    },
  });
  await prisma.docenteInstitucion.create({
    data: {
      docenteId: docenteCamila.id,
      institucionId: instB.id,
      numeroEmpleado: 'D-2002',
      activo: true,
    },
  });

  // ----- Materias -----
  const isw = await prisma.materia.create({
    data: {
      institucionId: instA.id,
      clave: 'ISW-101',
      nombre: 'Ingeniería de Software',
      programaEducativo: 'Ingeniería en Sistemas Computacionales',
      descripcion: 'Fundamentos y buenas prácticas de la ingeniería de software',
      activa: true,
    },
  });
  const bdd = await prisma.materia.create({
    data: {
      institucionId: instA.id,
      clave: 'BDD-201',
      nombre: 'Bases de Datos',
      programaEducativo: 'Ingeniería en Sistemas Computacionales',
      descripcion: 'Diseño y administración de bases de datos relacionales',
      activa: true,
    },
  });
  const con = await prisma.materia.create({
    data: {
      institucionId: instA.id,
      clave: 'CON-101',
      nombre: 'Contabilidad General',
      programaEducativo: 'Contaduría',
      descripcion: 'Principios básicos de la contabilidad financiera',
      activa: true,
    },
  });
  const dsw = await prisma.materia.create({
    data: {
      institucionId: instB.id,
      clave: 'DSW-201',
      nombre: 'Desarrollo de Software',
      programaEducativo: 'Ingeniería de Sistemas',
      descripcion: 'Ciclo de vida y construcción de aplicaciones de software',
      activa: true,
    },
  });
  const eco = await prisma.materia.create({
    data: {
      institucionId: instB.id,
      clave: 'ECO-101',
      nombre: 'Microeconomía',
      programaEducativo: 'Economía',
      descripcion: 'Teoría del consumidor y de la empresa',
      activa: true,
    },
  });

  // ----- Asignaciones (docente ↔ materia) -----
  const asignRobertoIsw = await prisma.asignacionDocente.create({
    data: {
      docenteInstitucionId: (
        await prisma.docenteInstitucion.findFirstOrThrow({
          where: { docenteId: docenteRoberto.id },
        })
      ).id,
      materiaId: isw.id,
      periodoEscolar: '2026-1',
    },
  });
  await prisma.asignacionDocente.create({
    data: {
      docenteInstitucionId: (
        await prisma.docenteInstitucion.findFirstOrThrow({
          where: { docenteId: docenteRoberto.id },
        })
      ).id,
      materiaId: bdd.id,
      periodoEscolar: '2026-1',
    },
  });
  await prisma.asignacionDocente.create({
    data: {
      docenteInstitucionId: (
        await prisma.docenteInstitucion.findFirstOrThrow({
          where: { docenteId: docenteLaura.id },
        })
      ).id,
      materiaId: con.id,
      periodoEscolar: '2026-1',
    },
  });
  await prisma.asignacionDocente.create({
    data: {
      docenteInstitucionId: (
        await prisma.docenteInstitucion.findFirstOrThrow({
          where: { docenteId: docenteAndres.id },
        })
      ).id,
      materiaId: eco.id,
      periodoEscolar: '2026-1',
    },
  });
  const asignCamilaDsw = await prisma.asignacionDocente.create({
    data: {
      docenteInstitucionId: (
        await prisma.docenteInstitucion.findFirstOrThrow({
          where: { docenteId: docenteCamila.id },
        })
      ).id,
      materiaId: dsw.id,
      periodoEscolar: '2026-1',
    },
  });

  // ----- Solicitudes de clase espejo (Semana 3) -----
  await prisma.solicitudClaseEspejo.create({
    data: {
      asignacionOrigenId: asignRobertoIsw.id,
      institucionDestinoId: instB.id,
      materiaDestinoId: dsw.id,
      titulo: 'Clase espejo: Metodologías Ágiles de Software',
      objetivo:
        'Comparar y aplicar metodologías ágiles (Scrum, Kanban) en equipos binacionales',
      fechaPropuesta: new Date('2026-03-15'),
      estado: 'PENDIENTE',
    },
  });
  await prisma.solicitudClaseEspejo.create({
    data: {
      asignacionOrigenId: asignCamilaDsw.id,
      institucionDestinoId: instA.id,
      materiaDestinoId: isw.id,
      titulo: 'Clase espejo: Calidad y Pruebas de Software',
      objetivo:
        'Compartir técnicas de aseguramiento de calidad y pruebas automatizadas',
      fechaPropuesta: new Date('2026-03-20'),
      estado: 'PENDIENTE',
    },
  });

  console.log('\n✅ Base de datos sembrada correctamente.\n');
  console.log('================ CREDENCIALES DE DEMO ================');
  console.log('Contraseña común para todos: ' + PASSWORD);
  console.log('');
  console.log('— AGENTE (Institución A: Calkiní, México) —');
  console.log('   correo: agente.calkini@clasesespejo.mx');
  console.log('');
  console.log('— AGENTE (Institución B: Colombia) —');
  console.log('   correo: agente.colombia@clasesespejo.co');
  console.log('');
  console.log('— DOCENTE (Institución A) —');
  console.log('   correo: roberto.perez@clasesespejo.mx');
  console.log('   correo: laura.martinez@clasesespejo.mx');
  console.log('');
  console.log('— DOCENTE (Institución B) —');
  console.log('   correo: andres.garcia@clasesespejo.co');
  console.log('   correo: camila.rodriguez@clasesespejo.co');
  console.log('======================================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
