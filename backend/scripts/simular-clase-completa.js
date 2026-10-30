/**
 * Simulación integral de una clase espejo con cuatro instituciones.
 *
 * Crea una clase nueva (no reutiliza las clases existentes) y le carga:
 * planificación, sesiones, reportes confirmados, actividades, evidencias,
 * evaluación, mensajes, una solicitud de cancelación rechazada y la retirada de
 * una institución. Después cierra la clase con tres instituciones activas y
 * genera el acta y el expediente para verificar el resultado.
 *
 * Requiere el servidor en http://127.0.0.1:3000 para ejecutar las acciones que
 * pasan por los servicios reales (cancelación, votos, salida y cierre).
 *
 * Uso, desde backend:
 *   node scripts/simular-clase-completa.js
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('../dist/generated/prisma/client');

const prisma = new PrismaClient();
const BASE = process.env.SIMULACION_BASE_URL || 'http://127.0.0.1:3000';
const PASSWORD = 'Demo1234';
const TITULO =
  'Simulación integral de clase espejo con cuatro instituciones (30-oct-2026)';

const CUENTAS = {
  calkini: {
    docente: 'sofia.gomez@clasesespejo.mx',
    agente: 'agente.calkini@clasesespejo.mx',
  },
  colombia: {
    docente: 'isabella.cardenas@clasesespejo.co',
    agente: 'agente.colombia@clasesespejo.co',
  },
  sevilla: {
    docente: 'docente.sevilla@clasesespejo.es',
    agente: 'agente.sevilla@clasesespejo.es',
  },
  uba: {
    docente: 'docente.uba@clasesespejo.ar',
    agente: 'agente.uba@clasesespejo.ar',
  },
};

async function api(ruta, token, metodo = 'GET', cuerpo) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  if (!respuesta.ok) {
    throw new Error(
      `${metodo} ${ruta} → ${respuesta.status}: ${JSON.stringify(datos)}`,
    );
  }
  return datos;
}

async function iniciarSesion(correo) {
  const respuesta = await api('/auth/login', null, 'POST', {
    correo,
    password: PASSWORD,
  });
  if (!respuesta?.access_token) {
    throw new Error(`No se pudo iniciar sesión con ${correo}`);
  }
  return respuesta.access_token;
}

async function buscarInstitucion(nombre) {
  const institucion = await prisma.institucion.findFirst({ where: { nombre } });
  if (!institucion) throw new Error(`No existe la institución: ${nombre}`);
  return institucion;
}

async function buscarAsignacion(institucionId, correoDocente) {
  const docente = await prisma.docente.findFirst({
    where: { usuario: { correo: correoDocente } },
  });
  if (!docente) throw new Error(`No existe el docente ${correoDocente}`);
  const vinculo = await prisma.docenteInstitucion.findFirst({
    where: { docenteId: docente.id, institucionId },
  });
  if (!vinculo) {
    throw new Error(`El docente ${correoDocente} no está en la institución`);
  }
  const asignacion = await prisma.asignacionDocente.findFirst({
    where: { docenteInstitucionId: vinculo.id },
  });
  if (!asignacion) {
    throw new Error(`El docente ${correoDocente} no tiene asignación`);
  }
  return { asignacion, vinculo };
}

function fecha(diasDesdeHoy, hora = 12) {
  const d = new Date();
  d.setUTCHours(hora, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + diasDesdeHoy);
  return d;
}

async function cargarSimulacion(proyectoId) {
  const docentes = await prisma.proyectoDocente.findMany({
    where: { proyectoId },
    include: {
      asignacionDocente: {
        include: {
          docenteInstitucion: {
            include: { docente: { include: { usuario: true } }, institucion: true },
          },
        },
      },
    },
  });
  const sesiones = await prisma.sesion.findMany({
    where: { proyectoId },
    include: { reporte: { include: { participaciones: true } } },
    orderBy: { fechaHora: 'asc' },
  });
  return { docentes, sesiones };
}

async function crearContenido(proyecto, docentes) {
  const planificacion = await prisma.planificacionConjunta.create({
    data: {
      proyectoId: proyecto.id,
      objetivosAcordados:
        'Analizar un problema real de sostenibilidad desde cuatro contextos y construir una propuesta conjunta.',
      temasAcordados:
        'Economía circular, agua y territorio; innovación educativa; ciudadanía global; presentación de resultados.',
      metodologia:
        'Aprendizaje basado en proyectos, trabajo colaborativo internacional y sesiones sincrónicas en Zoom.',
      plataforma: proyecto.plataforma,
      estado: 'APROBADA',
    },
  });

  await prisma.participacionPlanificacion.createMany({
    data: docentes.map((docente) => ({
      planificacionId: planificacion.id,
      proyectoDocenteId: docente.id,
      estatusConfirmacion: 'CONFIRMADA',
      confirmadaEn: fecha(-35, 15),
    })),
  });

  await prisma.reportePlanificacion.create({
    data: {
      planificacionId: planificacion.id,
      vistoBueno: true,
      observaciones:
        'Las cuatro instituciones revisaron y aprobaron la planificación conjunta.',
      generadoEn: fecha(-34, 16),
    },
  });

  const definiciones = [
    {
      titulo: 'Sesión 1 · Diagnóstico y acuerdos',
      desarrollo:
        'Las cuatro instituciones se presentaron, compartieron el diagnóstico de sus territorios y acordaron el problema central del proyecto.',
      asistentes: 92,
      incidencias: 'Sin incidencias técnicas relevantes.',
      acuerdos:
        'Cada institución enviará un diagnóstico breve antes de la siguiente sesión.',
      observaciones:
        'Aporté la caracterización local y el mapa de actores de Calkiní.',
      dias: -24,
    },
    {
      titulo: 'Sesión 2 · Innovación y sostenibilidad',
      desarrollo:
        'Se contrastaron propuestas de economía circular y se organizaron equipos mixtos entre las cuatro instituciones.',
      asistentes: 96,
      incidencias:
        'Un equipo de Sevilla tuvo un retraso de conexión de cinco minutos.',
      acuerdos:
        'Cada equipo subirá una ficha de idea y una evidencia visual antes de la tercera sesión.',
      observaciones:
        'El equipo de Colombia coordinó la matriz comparativa de soluciones.',
      dias: -17,
    },
    {
      titulo: 'Sesión 3 · Taller colaborativo',
      desarrollo:
        'Los equipos trabajaron en la propuesta conjunta, revisaron evidencias y prepararon la presentación final.',
      asistentes: 94,
      incidencias:
        'Se acordó que Buenos Aires compartiera la plantilla de presentación por el aula virtual.',
      acuerdos:
        'La presentación final se ensayará en la cuarta sesión y se entregará la evaluación del proyecto.',
      observaciones:
        'La institución de Buenos Aires aportó la plantilla y la revisión de formato.',
      dias: -10,
    },
    {
      titulo: 'Sesión 4 · Presentación de resultados',
      desarrollo:
        'Se presentaron las propuestas finales, se contrastaron resultados y se realizó la evaluación conjunta de la experiencia.',
      asistentes: 98,
      incidencias: 'Sin incidencias.',
      acuerdos:
        'Se entregará el informe final y se conservarán las evidencias en el expediente de la clase.',
      observaciones:
        'La evaluación final se completó con la rúbrica acordada por las cuatro instituciones.',
      dias: -3,
    },
  ];

  const sesiones = [];
  for (const definicion of definiciones) {
    const sesion = await prisma.sesion.create({
      data: {
        proyectoId: proyecto.id,
        titulo: definicion.titulo,
        fechaHora: fecha(definicion.dias, 16),
        enlaceVirtual: `https://meet.example.com/clase-espejo-${proyecto.id}-${sesiones.length + 1}`,
        estado: 'FINALIZADA',
      },
    });
    sesiones.push(sesion);

    const reporte = await prisma.reporteClaseConjunta.create({
      data: {
        sesionId: sesion.id,
        desarrolloClase: definicion.desarrollo,
        totalAsistentes: definicion.asistentes,
        incidencias: definicion.incidencias,
        acuerdosSiguienteSesion: definicion.acuerdos,
        estado: 'CONFIRMADO',
      },
    });

    await prisma.participacionReporte.createMany({
      data: docentes.map((docente, indice) => ({
        reporteClaseId: reporte.id,
        proyectoDocenteId: docente.id,
        observaciones:
          indice === 0
            ? definicion.observaciones
            : 'Participé en el desarrollo de la sesión y confirmo los acuerdos registrados.',
        confirmadoEn: fecha(definicion.dias, 18),
      })),
    });

    await prisma.evidencia.create({
      data: {
        proyectoId: proyecto.id,
        sesionId: sesion.id,
        tipo: `Evidencia de ${definicion.titulo}`,
        enlaceUrl: `https://example.org/evidencias/clase-${proyecto.id}-sesion-${sesiones.length}.pdf`,
        registradaEn: fecha(definicion.dias, 17),
      },
    });
  }

  await prisma.actividad.createMany({
    data: [
      {
        proyectoId: proyecto.id,
        titulo: 'Diagnóstico local por institución',
        instrucciones:
          'Cada institución entregará un diagnóstico de una página sobre un problema de sostenibilidad de su territorio.',
        fechaLimite: fecha(-20),
      },
      {
        proyectoId: proyecto.id,
        titulo: 'Ficha de idea conjunta',
        instrucciones:
          'Los equipos mixtos entregarán una ficha con problema, propuesta, evidencia y siguiente paso.',
        fechaLimite: fecha(-13),
      },
      {
        proyectoId: proyecto.id,
        titulo: 'Presentación final y evaluación',
        instrucciones:
          'Entregar la presentación final y completar la rúbrica de evaluación de la experiencia.',
        fechaLimite: fecha(-5),
      },
    ],
  });

  await prisma.evidencia.createMany({
    data: [
      {
        proyectoId: proyecto.id,
        tipo: 'Acta de acuerdos',
        enlaceUrl: `https://example.org/evidencias/clase-${proyecto.id}-acta.pdf`,
        registradaEn: fecha(-24, 18),
      },
      {
        proyectoId: proyecto.id,
        tipo: 'Presentación de resultados',
        enlaceUrl: `https://example.org/evidencias/clase-${proyecto.id}-presentacion.pdf`,
        registradaEn: fecha(-3, 18),
      },
    ],
  });

  await prisma.evaluacion.create({
    data: {
      proyectoId: proyecto.id,
      instrumento: 'Rúbrica de evaluación conjunta',
      resultado:
        'Satisfactorio: las cuatro instituciones alcanzaron los objetivos acordados y la participación fue equilibrada.',
      observaciones:
        'Se recomienda repetir la experiencia y ampliar la participación estudiantil.',
    },
  });

  for (const [indice, docente] of docentes.entries()) {
    await prisma.mensaje.create({
      data: {
        proyectoId: proyecto.id,
        proyectoDocenteId: docente.id,
        contenido:
          [
            'Gracias por la sesión de hoy. Dejo el acta y los acuerdos en el aula virtual.',
            'Confirmo la asistencia y la entrega de la ficha de idea del equipo.',
            'Comparto la presentación final para que todas las instituciones la revisen.',
            'La evaluación conjunta quedó registrada. Excelente trabajo de los cuatro equipos.',
          ][indice],
        creadoEn: fecha(-20 + indice * 5, 12),
      },
    });
  }

  await prisma.proyectoEvento.create({
    data: {
      proyectoId: proyecto.id,
      tipo: 'CLASE_SIMULADA',
      motivo:
        'Simulación integral creada con planificación, sesiones, reportes, evidencias y evaluación.',
    },
  });
}

async function main() {
  const calkini = await buscarInstitucion(
    'Instituto Tecnológico Superior de Calkiní',
  );
  const colombia = await buscarInstitucion('Universidad Nacional de Colombia');
  const sevilla = await buscarInstitucion('Universidad de Sevilla');
  const buenosAires = await buscarInstitucion('Universidad de Buenos Aires');

  const cuentas = [
    { clave: 'calkini', institucion: calkini, rol: 'ORIGEN', correo: CUENTAS.calkini.docente },
    { clave: 'colombia', institucion: colombia, rol: 'DESTINO', correo: CUENTAS.colombia.docente },
    { clave: 'sevilla', institucion: sevilla, rol: 'COLABORADORA', correo: CUENTAS.sevilla.docente },
    { clave: 'uba', institucion: buenosAires, rol: 'COLABORADORA', correo: CUENTAS.uba.docente },
  ];

  for (const cuenta of cuentas) {
    const { asignacion, vinculo } = await buscarAsignacion(
      cuenta.institucion.id,
      cuenta.correo,
    );
    cuenta.asignacion = asignacion;
    cuenta.vinculo = vinculo;
  }

  const existente = await prisma.solicitudClaseEspejo.findFirst({
    where: { titulo: TITULO },
    include: { proyecto: { include: { participantes: true, sesiones: true } } },
  });
  if (existente?.proyecto) {
    console.log('La simulación ya existe; no se crea otra.');
    console.log(`Proyecto: ${existente.proyecto.id} — ${TITULO}`);
    console.log(`Abre /proyectos/${existente.proyecto.id}`);
    return;
  }

  const solicitud = await prisma.solicitudClaseEspejo.create({
    data: {
      asignacionOrigenId: cuentas[0].asignacion.id,
      asignacionDestinoId: cuentas[1].asignacion.id,
      institucionDestinoId: colombia.id,
      materiaDestinoId: cuentas[3].asignacion.materiaId,
      titulo: TITULO,
      objetivo:
        'Simular una clase espejo completa de cuatro instituciones con un historial verificable de planificación, sesiones, reportes, cancelación rechazada, retirada y cierre.',
      fechaPropuesta: fecha(-40),
      estado: 'APROBADA',
    },
  });

  const proyecto = await prisma.proyectoClaseEspejo.create({
    data: {
      solicitudId: solicitud.id,
      estado: 'EN_CURSO',
      fechaInicio: fecha(-40),
      fechaFin: fecha(-1),
      plataforma: 'Zoom',
    },
  });

  const docentes = [];
  for (const cuenta of cuentas) {
    docentes.push(
      await prisma.proyectoDocente.create({
        data: {
          proyectoId: proyecto.id,
          asignacionDocenteId: cuenta.asignacion.id,
          rol: cuenta.rol,
        },
      }),
    );
  }

  for (const [indice, cuenta] of cuentas.entries()) {
    await prisma.proyectoParticipante.create({
      data: {
        proyectoId: proyecto.id,
        institucionId: cuenta.institucion.id,
        docenteInstitucionId: cuenta.vinculo.id,
        rol: cuenta.rol,
        estado: 'APROBADA',
      },
    });
    void indice;
  }

  await crearContenido(proyecto, docentes);

  const tDocente = {
    calkini: await iniciarSesion(CUENTAS.calkini.docente),
    colombia: await iniciarSesion(CUENTAS.colombia.docente),
    sevilla: await iniciarSesion(CUENTAS.sevilla.docente),
    uba: await iniciarSesion(CUENTAS.uba.docente),
  };

  // Solicitud de cancelación de Sevilla; Colombia la rechaza para que la clase
  // siga abierta y quede el historial completo.
  await api(`/proyectos/${proyecto.id}/cancelacion`, tDocente.sevilla, 'POST', {
    motivo:
      'La institución propone cerrar la clase por incompatibilidad de calendario.',
  });
  await api(`/proyectos/${proyecto.id}/cancelacion/votos`, tDocente.colombia, 'POST', {
    decision: 'RECHAZADA',
    motivo:
      'La clase puede continuar: los equipos ya tienen acuerdos y evidencias en curso.',
  });

  // Una institución distinta se retira después del rechazo. Quedan tres.
  await api(`/proyectos/${proyecto.id}/salir`, tDocente.uba, 'POST', {
    motivo:
      'La Universidad de Buenos Aires cierra su participación por cambios en el calendario académico.',
  });

  // Cierre real: exige una evaluación y un reporte confirmado por sesión.
  await api(`/proyectos/${proyecto.id}/cerrar`, tDocente.calkini, 'POST');

  // Descargas reales de los dos informes.
  const tAgente = await iniciarSesion(CUENTAS.calkini.agente);
  const respuestaActa = await fetch(`${BASE}/proyectos/${proyecto.id}/acta-pdf`, {
    headers: { Authorization: `Bearer ${tDocente.calkini}` },
  });
  if (!respuestaActa.ok) {
    throw new Error(`No se pudo descargar el acta: ${respuestaActa.status}`);
  }
  const carpeta = path.resolve(__dirname, '..', '..', 'release');
  fs.mkdirSync(carpeta, { recursive: true });
  const rutaActa = path.join(
    carpeta,
    `simulacion-clase-${proyecto.id}-acta.pdf`,
  );
  fs.writeFileSync(
    rutaActa,
    Buffer.from(await respuestaActa.arrayBuffer()),
  );

  const respuestaExpediente = await fetch(
    `${BASE}/proyectos/${proyecto.id}/expediente-pdf`,
    { headers: { Authorization: `Bearer ${tAgente}` } },
  );
  if (!respuestaExpediente.ok) {
    throw new Error(
      `No se pudo descargar el expediente: ${respuestaExpediente.status}`,
    );
  }
  const rutaExpediente = path.join(
    carpeta,
    `simulacion-clase-${proyecto.id}-expediente.pdf`,
  );
  fs.writeFileSync(
    rutaExpediente,
    Buffer.from(await respuestaExpediente.arrayBuffer()),
  );

  const estado = await cargarSimulacion(proyecto.id);
  const final = await prisma.proyectoClaseEspejo.findUniqueOrThrow({
    where: { id: proyecto.id },
    include: {
      participantes: { include: { institucion: true } },
      cancelaciones: { include: { votos: true } },
      eventos: true,
    },
  });

  console.log('Simulación completa lista.');
  console.log(`Proyecto: ${proyecto.id} — ${TITULO}`);
  console.log(`Estado final: ${final.estado}`);
  console.log(`Sesiones: ${estado.sesiones.length}`);
  console.log(
    `Reportes confirmados: ${estado.sesiones.filter((s) => s.reporte?.estado === 'CONFIRMADO').length}`,
  );
  console.log(
    `Participantes: ${final.participantes
      .map((p) => `${p.institucion.nombre} (${p.estado})`)
      .join(', ')}`,
  );
  console.log(
    `Cancelaciones: ${final.cancelaciones
      .map(
        (c) =>
          `${c.estado} (${c.votos.filter((v) => v.decision === 'RECHAZADA').length} rechazo)`,
      )
      .join(', ')}`,
  );
  console.log(`Actividades: ${await prisma.actividad.count({ where: { proyectoId: proyecto.id } })}`);
  console.log(`Evidencias: ${await prisma.evidencia.count({ where: { proyectoId: proyecto.id } })}`);
  console.log(`Evaluaciones: ${await prisma.evaluacion.count({ where: { proyectoId: proyecto.id } })}`);
  console.log(`PDFs: ${rutaActa} y ${rutaExpediente}`);
  console.log(`Abre /proyectos/${proyecto.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
