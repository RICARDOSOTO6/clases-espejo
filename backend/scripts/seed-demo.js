/**
 * Script de demostración (simulación realista): limpia la base de datos y
 * siembra 2 instituciones, 5 materias por institución, 15 docentes,
 * asignaciones docente↔materia y solicitudes de clase espejo.
 * Uso:  node scripts/seed-demo.js   (desde la carpeta backend)
 */
require('dotenv').config();
const { PrismaClient } = require('../dist/generated/prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const PASSWORD = 'Demo1234';
let hash;

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

// clave -> asignación creada, por docente (correo -> { clave -> asignacion })
const asignaciones = {};

async function crearMaterias(institucionId, lista) {
  const map = {};
  for (const m of lista) {
    const creada = await prisma.materia.create({
      data: {
        institucionId,
        clave: m.clave,
        nombre: m.nombre,
        programaEducativo: m.programa,
        descripcion: m.desc,
        activa: true,
      },
    });
    map[m.clave] = creada;
  }
  return map;
}

async function crearAgente(institucionId, u) {
  const usuario = await prisma.usuario.create({
    data: {
      nombres: u.nombres,
      apellidoPaterno: u.apellidoPaterno,
      apellidoMaterno: u.apellidoMaterno,
      tipoDocumento: u.tipoDocumento,
      dni: u.dni,
      correo: u.correo,
      passwordHash: hash,
      activo: true,
    },
  });
  await prisma.agenteInternacionalizacion.create({
    data: { usuarioId: usuario.id, institucionId, cargo: u.cargo },
  });
}

async function crearDocente(institucionId, d, materiasMap, tipoDocumento) {
  const usuario = await prisma.usuario.create({
    data: {
      nombres: d.nombres,
      apellidoPaterno: d.apellidoPaterno,
      apellidoMaterno: d.apellidoMaterno,
      tipoDocumento,
      dni: d.dni,
      correo: d.correo,
      passwordHash: hash,
      activo: true,
    },
  });
  const docente = await prisma.docente.create({
    data: {
      usuarioId: usuario.id,
      gradoAcademico: d.grado,
      especialidad: d.especialidad,
    },
  });
  const di = await prisma.docenteInstitucion.create({
    data: {
      docenteId: docente.id,
      institucionId,
      numeroEmpleado: d.empleado,
      activo: true,
    },
  });

  const delDocente = {};
  for (const clave of d.materias) {
    const materia = materiasMap[clave];
    const asig = await prisma.asignacionDocente.create({
      data: {
        docenteInstitucionId: di.id,
        materiaId: materia.id,
        periodoEscolar: '2026-1',
      },
    });
    delDocente[clave] = asig;
  }
  asignaciones[d.correo] = delDocente;
}

async function main() {
  console.log('🧹 Limpiando base de datos...');
  for (const model of DELETE_ORDER) {
    await prisma[model].deleteMany({});
  }

  console.log('🌱 Sembrando simulación (2 instituciones, 10 materias, 15 docentes)...');
  hash = await bcrypt.hash(PASSWORD, 10);

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

  // ----- Agentes -----
  await crearAgente(instA.id, {
    nombres: 'María Fernanda',
    apellidoPaterno: 'López',
    apellidoMaterno: 'Hernández',
    tipoDocumento: 'DNI',
    dni: 'MFLH850101',
    correo: 'agente.calkini@clasesespejo.mx',
    cargo: 'Coordinadora de Internacionalización',
  });
  await crearAgente(instB.id, {
    nombres: 'Juan Carlos',
    apellidoPaterno: 'Ramírez',
    apellidoMaterno: 'Torres',
    tipoDocumento: 'Cédula de identidad',
    dni: 'JCRT780310',
    correo: 'agente.colombia@clasesespejo.co',
    cargo: 'Director de Internacionalización',
  });

  // ----- Materias -----
  const materiasA = await crearMaterias(instA.id, [
    { clave: 'ISW-101', nombre: 'Ingeniería de Software', programa: 'Ingeniería en Sistemas Computacionales', desc: 'Fundamentos y buenas prácticas de la ingeniería de software' },
    { clave: 'BDD-201', nombre: 'Bases de Datos', programa: 'Ingeniería en Sistemas Computacionales', desc: 'Diseño y administración de bases de datos relacionales' },
    { clave: 'RED-301', nombre: 'Redes de Computadoras', programa: 'Ingeniería en Sistemas Computacionales', desc: 'Arquitectura y protocolos de redes de datos' },
    { clave: 'CON-101', nombre: 'Contabilidad General', programa: 'Contaduría', desc: 'Principios básicos de la contabilidad financiera' },
    { clave: 'ADM-201', nombre: 'Administración de Empresas', programa: 'Administración', desc: 'Fundamentos de la administración organizacional' },
  ]);
  const materiasB = await crearMaterias(instB.id, [
    { clave: 'DSW-201', nombre: 'Desarrollo de Software', programa: 'Ingeniería de Sistemas', desc: 'Ciclo de vida y construcción de aplicaciones' },
    { clave: 'SIS-301', nombre: 'Sistemas de Información', programa: 'Ingeniería de Sistemas', desc: 'Análisis y diseño de sistemas de información' },
    { clave: 'TEL-401', nombre: 'Telecomunicaciones', programa: 'Ingeniería Electrónica', desc: 'Sistemas y redes de telecomunicaciones' },
    { clave: 'ECO-101', nombre: 'Microeconomía', programa: 'Economía', desc: 'Teoría del consumidor y de la empresa' },
    { clave: 'NIN-301', nombre: 'Negocios Internacionales', programa: 'Negocios Internacionales', desc: 'Entorno global de los negocios' },
  ]);

  // ----- Docentes (8 en A, 7 en B) -----
  const docentesA = [
    { nombres: 'Roberto', apellidoPaterno: 'Pérez', apellidoMaterno: 'Gutiérrez', grado: 'Maestría', especialidad: 'Ingeniería de Software', dni: 'RPG900415', correo: 'roberto.perez@clasesespejo.mx', empleado: 'D-1001', materias: ['ISW-101'] },
    { nombres: 'Sofía', apellidoPaterno: 'Gómez', apellidoMaterno: 'Ruiz', grado: 'Maestría', especialidad: 'Ingeniería de Software', dni: 'SGR910508', correo: 'sofia.gomez@clasesespejo.mx', empleado: 'D-1002', materias: ['ISW-101'] },
    { nombres: 'Carlos', apellidoPaterno: 'Hernández', apellidoMaterno: 'Díaz', grado: 'Maestría', especialidad: 'Bases de Datos', dni: 'CHD880712', correo: 'carlos.hernandez@clasesespejo.mx', empleado: 'D-1003', materias: ['BDD-201'] },
    { nombres: 'Ana', apellidoPaterno: 'Sánchez', apellidoMaterno: 'López', grado: 'Doctorado', especialidad: 'Redes de Computadoras', dni: 'ASL870903', correo: 'ana.sanchez@clasesespejo.mx', empleado: 'D-1004', materias: ['RED-301'] },
    { nombres: 'Elena', apellidoPaterno: 'Castro', apellidoMaterno: 'Núñez', grado: 'Maestría', especialidad: 'Redes de Computadoras', dni: 'ECN920611', correo: 'elena.castro@clasesespejo.mx', empleado: 'D-1005', materias: ['RED-301'] },
    { nombres: 'Laura', apellidoPaterno: 'Martínez', apellidoMaterno: 'Cruz', grado: 'Licenciatura', especialidad: 'Contaduría', dni: 'LMC930720', correo: 'laura.martinez@clasesespejo.mx', empleado: 'D-1006', materias: ['CON-101'] },
    { nombres: 'Jorge', apellidoPaterno: 'Morales', apellidoMaterno: 'Vega', grado: 'Licenciatura', especialidad: 'Contabilidad', dni: 'JMV890414', correo: 'jorge.morales@clasesespejo.mx', empleado: 'D-1007', materias: ['CON-101'] },
    { nombres: 'Miguel', apellidoPaterno: 'Torres', apellidoMaterno: 'Ramos', grado: 'Licenciatura', especialidad: 'Administración', dni: 'MTR950225', correo: 'miguel.torres@clasesespejo.mx', empleado: 'D-1008', materias: ['ADM-201'] },
  ];
  const docentesB = [
    { nombres: 'Andrés', apellidoPaterno: 'García', apellidoMaterno: 'Molina', grado: 'Doctorado', especialidad: 'Economía', dni: 'AGM880520', correo: 'andres.garcia@clasesespejo.co', empleado: 'D-2001', materias: ['ECO-101'] },
    { nombres: 'Santiago', apellidoPaterno: 'Giraldo', apellidoMaterno: 'Osorio', grado: 'Doctorado', especialidad: 'Economía', dni: 'SGO840810', correo: 'santiago.giraldo@clasesespejo.co', empleado: 'D-2002', materias: ['ECO-101'] },
    { nombres: 'Camila', apellidoPaterno: 'Rodríguez', apellidoMaterno: 'Salazar', grado: 'Maestría', especialidad: 'Desarrollo de Software', dni: 'CRS950815', correo: 'camila.rodriguez@clasesespejo.co', empleado: 'D-2003', materias: ['DSW-201'] },
    { nombres: 'Isabella', apellidoPaterno: 'Cárdenas', apellidoMaterno: 'Uribe', grado: 'Maestría', especialidad: 'Desarrollo de Software', dni: 'ICU960320', correo: 'isabella.cardenas@clasesespejo.co', empleado: 'D-2004', materias: ['DSW-201'] },
    { nombres: 'Felipe', apellidoPaterno: 'Ortiz', apellidoMaterno: 'Peña', grado: 'Licenciatura', especialidad: 'Sistemas de Información', dni: 'FOP910105', correo: 'felipe.ortiz@clasesespejo.co', empleado: 'D-2005', materias: ['SIS-301'] },
    { nombres: 'Valeria', apellidoPaterno: 'Rojas', apellidoMaterno: 'Cardona', grado: 'Maestría', especialidad: 'Telecomunicaciones', dni: 'VRC930715', correo: 'valeria.rojas@clasesespejo.co', empleado: 'D-2006', materias: ['TEL-401'] },
    { nombres: 'Diego', apellidoPaterno: 'Mendoza', apellidoMaterno: 'Ríos', grado: 'Licenciatura', especialidad: 'Negocios Internacionales', dni: 'DMR900530', correo: 'diego.mendoza@clasesespejo.co', empleado: 'D-2007', materias: ['NIN-301'] },
  ];

  for (const d of docentesA) await crearDocente(instA.id, d, materiasA, 'DNI');
  for (const d of docentesB) await crearDocente(instB.id, d, materiasB, 'Cédula de identidad');

  // ----- Solicitudes de clase espejo -----
  await prisma.solicitudClaseEspejo.create({
    data: {
      asignacionOrigenId: asignaciones['roberto.perez@clasesespejo.mx']['ISW-101'].id,
      institucionDestinoId: instB.id,
      materiaDestinoId: materiasB['DSW-201'].id,
      titulo: 'Clase espejo: Metodologías Ágiles de Software',
      objetivo: 'Comparar y aplicar metodologías ágiles (Scrum, Kanban) en equipos binacionales',
      fechaPropuesta: new Date('2026-03-15'),
      estado: 'PENDIENTE',
    },
  });
  await prisma.solicitudClaseEspejo.create({
    data: {
      asignacionOrigenId: asignaciones['camila.rodriguez@clasesespejo.co']['DSW-201'].id,
      institucionDestinoId: instA.id,
      materiaDestinoId: materiasA['ISW-101'].id,
      titulo: 'Clase espejo: Calidad y Pruebas de Software',
      objetivo: 'Compartir técnicas de aseguramiento de calidad y pruebas automatizadas',
      fechaPropuesta: new Date('2026-03-20'),
      estado: 'PENDIENTE',
    },
  });
  await prisma.solicitudClaseEspejo.create({
    data: {
      asignacionOrigenId: asignaciones['ana.sanchez@clasesespejo.mx']['RED-301'].id,
      institucionDestinoId: instB.id,
      materiaDestinoId: materiasB['TEL-401'].id,
      titulo: 'Clase espejo: Redes y Telecomunicaciones',
      objetivo: 'Analizar la convergencia de redes de datos y telecomunicaciones',
      fechaPropuesta: new Date('2026-04-05'),
      estado: 'PENDIENTE',
    },
  });

  console.log('\n✅ Simulación sembrada correctamente.\n');
  console.log('================ CREDENCIALES ================');
  console.log('Contraseña común para todos: ' + PASSWORD);
  console.log('');
  console.log('— AGENTES —');
  console.log('  agente.calkini@clasesespejo.mx   (México)');
  console.log('  agente.colombia@clasesespejo.co  (Colombia)');
  console.log('');
  console.log('— DOCENTES (México) —');
  for (const d of docentesA) console.log('  ' + d.correo);
  console.log('— DOCENTES (Colombia) —');
  for (const d of docentesB) console.log('  ' + d.correo);
  console.log('==============================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
