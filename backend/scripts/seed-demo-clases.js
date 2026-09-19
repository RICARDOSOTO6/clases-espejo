/**
 * Simulación de clases espejo para fines demostrativos.
 *
 * Crea, sobre los docentes e instituciones que ya existen, un escenario con
 * proyectos FINALIZADOS, EN CURSO y EN PLANIFICACIÓN a la vez, más solicitudes
 * pendientes, en revisión y rechazadas. Las fechas se calculan RELATIVAS a hoy
 * para que el escenario quede siempre alrededor de la fecha actual.
 *
 * Uso:   node scripts/seed-demo-clases.js
 * Borra: node scripts/borrar-demo-clases.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../dist/generated/prisma/client');

const p = new PrismaClient();

const HOY = new Date();
HOY.setHours(0, 0, 0, 0);

/** Fecha con hora, a `n` días de hoy. */
function dia(n, hora = 10) {
  const d = new Date(HOY);
  d.setDate(d.getDate() + n);
  d.setHours(hora, 0, 0, 0);
  return d;
}
/** Fecha sin hora, a `n` días de hoy. */
function fecha(n) {
  const d = new Date(HOY);
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  const instituciones = await p.institucion.findMany();
  const mx = instituciones.find((i) => i.codigoPais === 'MX');
  const co = instituciones.find((i) => i.codigoPais === 'CO');
  if (!mx || !co) throw new Error('Se esperaban instituciones de MX y CO');

  const agenteMx = await p.agenteInternacionalizacion.findFirst({
    where: { institucionId: mx.id },
  });
  const agenteCo = await p.agenteInternacionalizacion.findFirst({
    where: { institucionId: co.id },
  });
  if (!agenteMx || !agenteCo) throw new Error('Faltan agentes');

  const asignaciones = await p.asignacionDocente.findMany({
    include: {
      materia: true,
      docenteInstitucion: {
        include: { docente: { include: { usuario: true } } },
      },
    },
  });

  /** Busca la asignación de un docente por nombre (no depende del orden). */
  const asignacionDe = (institucionId, nombres) => {
    const a = asignaciones.find(
      (x) =>
        x.docenteInstitucion.institucionId === institucionId &&
        x.docenteInstitucion.docente.usuario.nombres === nombres,
    );
    if (!a) throw new Error(`No se encontró la asignación de ${nombres}`);
    return a;
  };

  // Parejas coherentes por área: software↔software, redes↔telecom, etc.
  const A = {
    roberto: asignacionDe(mx.id, 'Roberto'), // Ing. de Software
    sofia: asignacionDe(mx.id, 'Sofía'), // Ing. de Software
    carlos: asignacionDe(mx.id, 'Carlos'), // Bases de Datos
    elena: asignacionDe(mx.id, 'Elena'), // Redes de Computadoras
    laura: asignacionDe(mx.id, 'Laura'), // Contabilidad
    jorge: asignacionDe(mx.id, 'Jorge'), // Contabilidad
    miguel: asignacionDe(mx.id, 'Miguel'), // Administración
  };
  const B = {
    camila: asignacionDe(co.id, 'Camila'), // Desarrollo de Software
    isabella: asignacionDe(co.id, 'Isabella'), // Desarrollo de Software
    felipe: asignacionDe(co.id, 'Felipe'), // Sistemas de Información
    valeria: asignacionDe(co.id, 'Valeria'), // Telecomunicaciones
    diego: asignacionDe(co.id, 'Diego'), // Negocios Internacionales
    andres: asignacionDe(co.id, 'Andrés'), // Microeconomía
    santiago: asignacionDe(co.id, 'Santiago'), // Microeconomía
  };

  // Archivos de evidencia para que los enlaces funcionen de verdad
  const uploadsDir = path.join(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  ['demo-evidencia-1.pdf', 'demo-evidencia-2.pdf', 'demo-evidencia-3.pdf'].forEach(
    (nombre, i) => {
      fs.writeFileSync(
        path.join(uploadsDir, nombre),
        `%PDF-1.4\n% Evidencia de demostración ${i + 1}\n`,
      );
    },
  );

  const ids = { solicitudes: [], proyectos: [], sesiones: [], evidencias: [] };
  const url = (n) => `https://meet.ejemplo.edu/clase-espejo-${n}`;

  async function crearSolicitud({
    origen,
    destino,
    titulo,
    objetivo,
    estado,
    fechaPropuesta,
    revisiones = [],
  }) {
    const solicitud = await p.solicitudClaseEspejo.create({
      data: {
        asignacionOrigenId: origen.id,
        asignacionDestinoId: estado === 'APROBADA' ? destino.id : null,
        institucionDestinoId: co.id,
        materiaDestinoId: destino.materiaId,
        titulo,
        objetivo,
        fechaPropuesta,
        estado,
      },
    });
    ids.solicitudes.push(solicitud.id);

    for (const rev of revisiones) {
      await p.revisionSolicitud.create({
        data: {
          solicitudId: solicitud.id,
          agenteId: rev.agente,
          etapa: rev.etapa,
          decision: rev.decision,
          comentario: rev.comentario ?? '',
          revisadaEn: rev.fecha,
        },
      });
    }
    return solicitud;
  }

  async function crearProyecto({
    solicitud,
    origen,
    destino,
    estado,
    inicio,
    fin,
    plataforma,
    planificacion,
    sesiones = [],
    actividades = [],
    evaluacion = null,
  }) {
    const proyecto = await p.proyectoClaseEspejo.create({
      data: {
        solicitudId: solicitud.id,
        estado,
        fechaInicio: inicio,
        fechaFin: fin,
        plataforma,
      },
    });
    ids.proyectos.push(proyecto.id);

    const pdOrigen = await p.proyectoDocente.create({
      data: {
        proyectoId: proyecto.id,
        asignacionDocenteId: origen.id,
        rol: 'ORIGEN',
      },
    });
    const pdDestino = await p.proyectoDocente.create({
      data: {
        proyectoId: proyecto.id,
        asignacionDocenteId: destino.id,
        rol: 'DESTINO',
      },
    });

    if (planificacion) {
      const plan = await p.planificacionConjunta.create({
        data: {
          proyectoId: proyecto.id,
          objetivosAcordados: planificacion.objetivos,
          temasAcordados: planificacion.temas,
          metodologia: planificacion.metodologia,
          plataforma,
          estado: planificacion.estado,
        },
      });
      const confirmada = planificacion.estado === 'APROBADA';
      for (const pd of [pdOrigen, pdDestino]) {
        await p.participacionPlanificacion.create({
          data: {
            planificacionId: plan.id,
            proyectoDocenteId: pd.id,
            estatusConfirmacion: confirmada ? 'CONFIRMADA' : 'PENDIENTE',
            confirmadaEn: confirmada ? dia(-20, 12) : null,
          },
        });
      }
    }

    for (const s of sesiones) {
      const sesion = await p.sesion.create({
        data: {
          proyectoId: proyecto.id,
          titulo: s.titulo,
          fechaHora: s.fechaHora,
          enlaceVirtual: s.enlace,
          estado: s.estado,
        },
      });
      ids.sesiones.push(sesion.id);

      if (s.reporte) {
        const reporte = await p.reporteClaseConjunta.create({
          data: {
            sesionId: sesion.id,
            desarrolloClase: s.reporte.desarrollo,
            totalAsistentes: s.reporte.asistentes,
            incidencias: s.reporte.incidencias,
            acuerdosSiguienteSesion: s.reporte.acuerdos,
            estado: s.reporte.estado,
          },
        });
        const firmas = s.reporte.firmas ?? [];
        const docentes = [pdOrigen, pdDestino];
        for (let i = 0; i < docentes.length; i++) {
          const firmado = i < firmas.length;
          await p.participacionReporte.create({
            data: {
              reporteClaseId: reporte.id,
              proyectoDocenteId: docentes[i].id,
              observaciones: firmado ? firmas[i] : '',
              confirmadoEn: firmado ? dia(-2, 9) : null,
            },
          });
        }
        if (s.evidencia) {
          const evi = await p.evidencia.create({
            data: {
              proyectoId: proyecto.id,
              sesionId: sesion.id,
              tipo: s.evidencia.tipo,
              archivoUrl: `/uploads/${s.evidencia.archivo}`,
              registradaEn: s.fechaHora,
            },
          });
          ids.evidencias.push(evi.id);
        }
      }
    }

    for (const a of actividades) {
      await p.actividad.create({
        data: {
          proyectoId: proyecto.id,
          titulo: a.titulo,
          instrucciones: a.instrucciones,
          fechaLimite: a.fechaLimite,
        },
      });
    }

    if (evaluacion) {
      await p.evaluacion.create({
        data: {
          proyectoId: proyecto.id,
          instrumento: evaluacion.instrumento,
          resultado: evaluacion.resultado,
          observaciones: evaluacion.observaciones,
        },
      });
    }

    return proyecto;
  }

  // =====================================================================
  // 1) PROYECTOS TERMINADOS
  // =====================================================================
  const fin1 = await crearSolicitud({
    origen: A.roberto,
    destino: B.camila,
    titulo: 'Clase espejo: Ingeniería y Desarrollo de Software',
    objetivo:
      'Comparar las prácticas de desarrollo de software de ambas instituciones',
    estado: 'APROBADA',
    fechaPropuesta: fecha(-75),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-78, 9), comentario: 'Propuesta pertinente' },
      { agente: agenteCo.id, etapa: 'REVISION_DESTINO', decision: 'APROBADA', fecha: dia(-76, 11), comentario: 'Aceptada' },
    ],
  });
  await crearProyecto({
    solicitud: fin1,
    origen: A.roberto,
    destino: B.camila,
    estado: 'FINALIZADO',
    inicio: fecha(-70),
    fin: fecha(-42),
    plataforma: 'Zoom',
    planificacion: {
      objetivos: 'Aplicar buenas prácticas de desarrollo en equipos distribuidos',
      temas: 'Scrum, integración continua y pruebas automatizadas',
      metodologia: 'Aprendizaje basado en proyectos con equipos mixtos',
      estado: 'APROBADA',
    },
    sesiones: [
      {
        titulo: 'Sesión 1 · Marco de trabajo y equipos',
        fechaHora: dia(-63, 10),
        enlace: url(1),
        estado: 'FINALIZADA',
        evidencia: { tipo: 'Acta de sesión', archivo: 'demo-evidencia-1.pdf' },
        reporte: {
          desarrollo: 'Presentación de los equipos mixtos y del marco de trabajo',
          asistentes: 38,
          incidencias: 'Ninguna',
          acuerdos: 'Cada equipo define su tablero y sus acuerdos',
          estado: 'CONFIRMADO',
          firmas: ['Todo conforme', 'De acuerdo con lo registrado'],
        },
      },
      {
        titulo: 'Sesión 2 · Integración continua',
        fechaHora: dia(-56, 10),
        enlace: url(2),
        estado: 'FINALIZADA',
        evidencia: { tipo: 'Captura de práctica', archivo: 'demo-evidencia-2.pdf' },
        reporte: {
          desarrollo: 'Demostración de un flujo de integración continua',
          asistentes: 35,
          incidencias: 'Fallas de conexión al inicio',
          acuerdos: 'Documentar el flujo y compartirlo',
          estado: 'CONFIRMADO',
          firmas: ['Sin observaciones', 'Revisado'],
        },
      },
      {
        titulo: 'Sesión 3 · Pruebas automatizadas',
        fechaHora: dia(-49, 10),
        enlace: url(3),
        estado: 'FINALIZADA',
        evidencia: { tipo: 'Reporte de pruebas', archivo: 'demo-evidencia-3.pdf' },
        reporte: {
          desarrollo: 'Taller de pruebas unitarias y de integración',
          asistentes: 33,
          incidencias: 'Ninguna',
          acuerdos: 'Entregar la práctica conjunta',
          estado: 'CONFIRMADO',
          firmas: ['Conforme', 'Conforme'],
        },
      },
    ],
    actividades: [
      { titulo: 'Práctica 1 · Tablero del equipo', instrucciones: 'Configurar el tablero y los acuerdos del equipo', fechaLimite: fecha(-58) },
      { titulo: 'Práctica 2 · Flujo de integración', instrucciones: 'Documentar el flujo de integración continua', fechaLimite: fecha(-48) },
      { titulo: 'Entrega final · Informe conjunto', instrucciones: 'Informe con resultados y conclusiones', fechaLimite: fecha(-44) },
    ],
    evaluacion: {
      instrumento: 'Rúbrica de desempeño',
      resultado: 'Satisfactorio (4.5/5)',
      observaciones: 'Se cumplieron los objetivos; buena participación de ambos grupos',
    },
  });

  const fin2 = await crearSolicitud({
    origen: A.elena,
    destino: B.valeria,
    titulo: 'Clase espejo: Redes y Telecomunicaciones',
    objetivo: 'Analizar la convergencia entre redes de datos y telecomunicaciones',
    estado: 'APROBADA',
    fechaPropuesta: fecha(-40),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-42, 9), comentario: 'Aprobada' },
      { agente: agenteCo.id, etapa: 'REVISION_DESTINO', decision: 'APROBADA', fecha: dia(-41, 10), comentario: 'Aprobada' },
    ],
  });
  await crearProyecto({
    solicitud: fin2,
    origen: A.elena,
    destino: B.valeria,
    estado: 'FINALIZADO',
    inicio: fecha(-35),
    fin: fecha(-7),
    plataforma: 'Google Meet',
    planificacion: {
      objetivos: 'Identificar la convergencia de redes y telecomunicaciones',
      temas: 'Redes convergentes, VoIP y calidad de servicio',
      metodologia: 'Seminario con exposiciones de ambos grupos',
      estado: 'APROBADA',
    },
    sesiones: [
      {
        titulo: 'Sesión 1 · Redes convergentes',
        fechaHora: dia(-28, 11),
        enlace: url(4),
        estado: 'FINALIZADA',
        evidencia: { tipo: 'Presentación', archivo: 'demo-evidencia-1.pdf' },
        reporte: {
          desarrollo: 'Exposiciones sobre redes convergentes',
          asistentes: 41,
          incidencias: 'Ninguna',
          acuerdos: 'Preparar el laboratorio de VoIP',
          estado: 'CONFIRMADO',
          firmas: ['Conforme', 'Conforme'],
        },
      },
      {
        titulo: 'Sesión 2 · Calidad de servicio',
        fechaHora: dia(-14, 11),
        enlace: url(5),
        estado: 'FINALIZADA',
        evidencia: { tipo: 'Mediciones', archivo: 'demo-evidencia-2.pdf' },
        reporte: {
          desarrollo: 'Mediciones de latencia y jitter en ambos países',
          asistentes: 37,
          incidencias: 'Latencia alta en un tramo',
          acuerdos: 'Documentar los resultados',
          estado: 'CONFIRMADO',
          firmas: ['De acuerdo', 'De acuerdo'],
        },
      },
    ],
    actividades: [
      { titulo: 'Laboratorio de VoIP', instrucciones: 'Montar una llamada VoIP y medirla', fechaLimite: fecha(-21) },
      { titulo: 'Informe de mediciones', instrucciones: 'Comparar las mediciones de ambos países', fechaLimite: fecha(-9) },
    ],
    evaluacion: {
      instrumento: 'Encuesta de satisfacción',
      resultado: 'Muy satisfactorio (4.8/5)',
      observaciones: 'El intercambio entre grupos fue el punto más valorado',
    },
  });

  // =====================================================================
  // 2) PROYECTOS EN CURSO
  // =====================================================================
  const curso1 = await crearSolicitud({
    origen: A.sofia,
    destino: B.isabella,
    titulo: 'Clase espejo: Calidad y Pruebas de Software',
    objetivo: 'Aplicar un plan de pruebas común en equipos distribuidos',
    estado: 'APROBADA',
    fechaPropuesta: fecha(-30),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-28, 9), comentario: 'Aprobada' },
      { agente: agenteCo.id, etapa: 'REVISION_DESTINO', decision: 'APROBADA', fecha: dia(-27, 10), comentario: 'Aprobada' },
    ],
  });
  await crearProyecto({
    solicitud: curso1,
    origen: A.sofia,
    destino: B.isabella,
    estado: 'EN_CURSO',
    inicio: fecha(-21),
    fin: fecha(21),
    plataforma: 'Microsoft Teams',
    planificacion: {
      objetivos: 'Diseñar y ejecutar un plan de pruebas conjunto',
      temas: 'Casos de prueba, automatización y métricas de calidad',
      metodologia: 'Talleres prácticos por parejas',
      estado: 'APROBADA',
    },
    sesiones: [
      {
        titulo: 'Sesión 1 · Plan de pruebas',
        fechaHora: dia(-18, 10),
        enlace: url(6),
        estado: 'FINALIZADA',
        evidencia: { tipo: 'Plan de pruebas', archivo: 'demo-evidencia-1.pdf' },
        reporte: {
          desarrollo: 'Definición del plan de pruebas conjunto',
          asistentes: 34,
          incidencias: 'Ninguna',
          acuerdos: 'Cada equipo prepara sus casos de prueba',
          estado: 'CONFIRMADO',
          firmas: ['Conforme', 'Conforme'],
        },
      },
      {
        titulo: 'Sesión 2 · Automatización',
        fechaHora: dia(-11, 10),
        enlace: url(7),
        estado: 'FINALIZADA',
        evidencia: { tipo: 'Scripts', archivo: 'demo-evidencia-2.pdf' },
        reporte: {
          desarrollo: 'Taller de automatización de pruebas',
          asistentes: 31,
          incidencias: 'Ninguna',
          acuerdos: 'Integrar los scripts en el repositorio común',
          estado: 'CONFIRMADO',
          firmas: ['De acuerdo', 'De acuerdo'],
        },
      },
      {
        titulo: 'Sesión 3 · Métricas de calidad',
        fechaHora: dia(-4, 10),
        enlace: url(8),
        estado: 'FINALIZADA',
        reporte: {
          desarrollo: 'Revisión de métricas y cobertura',
          asistentes: 29,
          incidencias: 'Ninguna',
          acuerdos: 'Cerrar los hallazgos pendientes',
          estado: 'EN_REVISION',
          firmas: ['Firmado por mi parte'],
        },
      },
      { titulo: 'Sesión 4 · Revisión de hallazgos', fechaHora: dia(3, 10), enlace: url(9), estado: 'PROGRAMADA' },
      { titulo: 'Sesión 5 · Cierre de la experiencia', fechaHora: dia(10, 10), enlace: url(10), estado: 'PROGRAMADA' },
    ],
    actividades: [
      { titulo: 'Casos de prueba por equipo', instrucciones: 'Diseñar los casos de prueba del módulo asignado', fechaLimite: fecha(-12) },
      { titulo: 'Informe de cobertura', instrucciones: 'Medir y documentar la cobertura', fechaLimite: fecha(2) },
      { titulo: 'Autoevaluación', instrucciones: 'Reflexión individual sobre lo aprendido', fechaLimite: fecha(9) },
    ],
  });

  const curso2 = await crearSolicitud({
    origen: A.carlos,
    destino: B.felipe,
    titulo: 'Clase espejo: Bases de Datos y Sistemas de Información',
    objetivo: 'Modelar y consultar datos en un escenario compartido',
    estado: 'APROBADA',
    fechaPropuesta: fecha(-14),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-12, 9), comentario: 'Aprobada' },
      { agente: agenteCo.id, etapa: 'REVISION_DESTINO', decision: 'APROBADA', fecha: dia(-11, 10), comentario: 'Aprobada' },
    ],
  });
  await crearProyecto({
    solicitud: curso2,
    origen: A.carlos,
    destino: B.felipe,
    estado: 'EN_CURSO',
    inicio: fecha(-7),
    fin: fecha(35),
    plataforma: 'Zoom',
    planificacion: {
      objetivos: 'Diseñar un modelo de datos común para un caso real',
      temas: 'Modelado entidad-relación, normalización y consultas',
      metodologia: 'Aprendizaje por retos con datos reales',
      estado: 'APROBADA',
    },
    sesiones: [
      {
        titulo: 'Sesión 1 · Levantamiento de requisitos',
        fechaHora: dia(-5, 16),
        enlace: url(11),
        estado: 'FINALIZADA',
        reporte: {
          desarrollo: 'Levantamiento conjunto de requisitos de datos',
          asistentes: 44,
          incidencias: 'Ninguna',
          acuerdos: 'Cada equipo propone su modelo',
          estado: 'BORRADOR',
          firmas: [],
        },
      },
      { titulo: 'Sesión 2 · Normalización', fechaHora: dia(2, 16), enlace: url(12), estado: 'PROGRAMADA' },
      { titulo: 'Sesión 3 · Consultas avanzadas', fechaHora: dia(16, 16), enlace: url(13), estado: 'PROGRAMADA' },
    ],
    actividades: [
      { titulo: 'Modelo entidad-relación', instrucciones: 'Entregar el modelo propuesto', fechaLimite: fecha(1) },
      { titulo: 'Script de creación', instrucciones: 'Script SQL con las tablas normalizadas', fechaLimite: fecha(8) },
      { titulo: 'Consultas de negocio', instrucciones: 'Resolver las diez consultas planteadas', fechaLimite: fecha(22) },
    ],
  });

  // En curso, con una sesión cancelada (para ver ese estado en la interfaz)
  const curso3 = await crearSolicitud({
    origen: A.laura,
    destino: B.diego,
    titulo: 'Clase espejo: Contabilidad y Negocios Internacionales',
    objetivo: 'Analizar el registro contable de las operaciones internacionales',
    estado: 'APROBADA',
    fechaPropuesta: fecha(-20),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-18, 9), comentario: 'Aprobada' },
      { agente: agenteCo.id, etapa: 'REVISION_DESTINO', decision: 'APROBADA', fecha: dia(-17, 10), comentario: 'Aprobada' },
    ],
  });
  await crearProyecto({
    solicitud: curso3,
    origen: A.laura,
    destino: B.diego,
    estado: 'EN_CURSO',
    inicio: fecha(-14),
    fin: fecha(14),
    plataforma: 'Google Meet',
    planificacion: {
      objetivos: 'Registrar operaciones internacionales bajo una normativa común',
      temas: 'Tipo de cambio, aranceles y registro contable',
      metodologia: 'Estudio de casos',
      estado: 'EN_REVISION',
    },
    sesiones: [
      {
        titulo: 'Sesión 1 · Marco normativo',
        fechaHora: dia(-10, 9),
        enlace: url(14),
        estado: 'FINALIZADA',
        evidencia: { tipo: 'Caso resuelto', archivo: 'demo-evidencia-3.pdf' },
        reporte: {
          desarrollo: 'Comparación de los marcos normativos de ambos países',
          asistentes: 27,
          incidencias: 'Ninguna',
          acuerdos: 'Resolver el caso conjunto',
          estado: 'CONFIRMADO',
          firmas: ['Conforme', 'Conforme'],
        },
      },
      { titulo: 'Sesión 2 · Caso práctico (reprogramada)', fechaHora: dia(-3, 9), enlace: url(15), estado: 'CANCELADA' },
      { titulo: 'Sesión 2 bis · Caso práctico', fechaHora: dia(4, 9), enlace: url(16), estado: 'PROGRAMADA' },
    ],
    actividades: [
      { titulo: 'Registro de operaciones', instrucciones: 'Registrar las operaciones del caso', fechaLimite: fecha(-5) },
      { titulo: 'Análisis de aranceles', instrucciones: 'Comparar el impacto arancelario', fechaLimite: fecha(6) },
    ],
  });

  // =====================================================================
  // 3) PROYECTOS EN PLANIFICACIÓN
  // =====================================================================
  const plan1 = await crearSolicitud({
    origen: A.miguel,
    destino: B.andres,
    titulo: 'Clase espejo: Administración y Microeconomía',
    objetivo: 'Contrastar decisiones empresariales con el entorno económico',
    estado: 'APROBADA',
    fechaPropuesta: fecha(10),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-4, 9), comentario: 'Aprobada' },
      { agente: agenteCo.id, etapa: 'REVISION_DESTINO', decision: 'APROBADA', fecha: dia(-3, 10), comentario: 'Aprobada' },
    ],
  });
  await crearProyecto({
    solicitud: plan1,
    origen: A.miguel,
    destino: B.andres,
    estado: 'EN_PLANIFICACION',
    inicio: fecha(7),
    fin: fecha(35),
    plataforma: 'Por definir',
    planificacion: {
      objetivos: 'Contrastar decisiones empresariales con el entorno económico',
      temas: 'Oferta, demanda y estructura de mercado',
      metodologia: 'Análisis de casos con datos reales',
      estado: 'BORRADOR',
    },
    sesiones: [
      { titulo: 'Sesión 1 · Apertura', fechaHora: dia(9, 15), enlace: url(17), estado: 'PROGRAMADA' },
      { titulo: 'Sesión 2 · Análisis de casos', fechaHora: dia(16, 15), enlace: url(18), estado: 'PROGRAMADA' },
    ],
    actividades: [
      { titulo: 'Recolección de indicadores', instrucciones: 'Buscar indicadores económicos de ambos países', fechaLimite: fecha(12) },
    ],
  });

  const plan2 = await crearSolicitud({
    origen: A.jorge,
    destino: B.santiago,
    titulo: 'Clase espejo: Costos y Microeconomía',
    objetivo: 'Analizar la estructura de costos de una empresa tipo',
    estado: 'APROBADA',
    fechaPropuesta: fecha(21),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-1, 9), comentario: 'Aprobada' },
      { agente: agenteCo.id, etapa: 'REVISION_DESTINO', decision: 'APROBADA', fecha: dia(0, 10), comentario: 'Aprobada' },
    ],
  });
  await crearProyecto({
    solicitud: plan2,
    origen: A.jorge,
    destino: B.santiago,
    estado: 'EN_PLANIFICACION',
    inicio: fecha(21),
    fin: fecha(49),
    plataforma: 'Por definir',
    planificacion: null,
    sesiones: [],
    actividades: [],
  });

  // =====================================================================
  // 4) PROYECTO CANCELADO
  // =====================================================================
  const cancelado = await crearSolicitud({
    origen: A.elena,
    destino: B.camila,
    titulo: 'Clase espejo: Gestión de redes (cancelada)',
    objetivo: 'Comparar la operación de redes institucionales',
    estado: 'APROBADA',
    fechaPropuesta: fecha(-45),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-43, 9), comentario: 'Aprobada' },
      { agente: agenteCo.id, etapa: 'REVISION_DESTINO', decision: 'APROBADA', fecha: dia(-42, 10), comentario: 'Aprobada' },
    ],
  });
  await crearProyecto({
    solicitud: cancelado,
    origen: A.elena,
    destino: B.camila,
    estado: 'CANCELADO',
    inicio: fecha(-30),
    fin: fecha(-2),
    plataforma: 'Zoom',
    planificacion: {
      objetivos: 'Comparar la operación de redes institucionales',
      temas: 'Monitoreo y disponibilidad',
      metodologia: 'Seminario',
      estado: 'BORRADOR',
    },
    sesiones: [
      {
        titulo: 'Sesión 1 · Introducción',
        fechaHora: dia(-25, 12),
        enlace: url(19),
        estado: 'FINALIZADA',
        reporte: {
          desarrollo: 'Introducción al monitoreo de redes',
          asistentes: 22,
          incidencias: 'Ninguna',
          acuerdos: 'Continuar la próxima semana',
          estado: 'BORRADOR',
          firmas: [],
        },
      },
    ],
  });

  // =====================================================================
  // 5) SOLICITUDES PENDIENTES, EN REVISIÓN Y RECHAZADAS
  // =====================================================================

  // Pendientes de la 1.ª revisión (agente de origen, MX)
  await crearSolicitud({
    origen: A.roberto,
    destino: B.felipe,
    titulo: 'Clase espejo: Arquitectura de Software',
    objetivo: 'Comparar estilos arquitectónicos usados en la industria',
    estado: 'PENDIENTE',
    fechaPropuesta: fecha(28),
  });
  await crearSolicitud({
    origen: A.carlos,
    destino: B.isabella,
    titulo: 'Clase espejo: Analítica de datos',
    objetivo: 'Explorar casos de analítica aplicada a los negocios',
    estado: 'PENDIENTE',
    fechaPropuesta: fecha(35),
  });

  // Aprobadas por origen: esperan la 2.ª revisión (agente de destino, CO)
  await crearSolicitud({
    origen: A.elena,
    destino: B.santiago,
    titulo: 'Clase espejo: Seguridad informática',
    objetivo: 'Analizar controles de seguridad en redes institucionales',
    estado: 'APROBADA_POR_ORIGEN',
    fechaPropuesta: fecha(24),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-2, 9), comentario: 'Aprobada, pasa a destino' },
    ],
  });
  await crearSolicitud({
    origen: A.laura,
    destino: B.andres,
    titulo: 'Clase espejo: Finanzas corporativas',
    objetivo: 'Comparar la estructura financiera de empresas de la región',
    estado: 'APROBADA_POR_ORIGEN',
    fechaPropuesta: fecha(31),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-1, 10), comentario: 'Aprobada' },
    ],
  });

  // Rechazada por el agente de origen
  await crearSolicitud({
    origen: A.sofia,
    destino: B.diego,
    titulo: 'Clase espejo: Introducción a la programación',
    objetivo: 'Nivelar los conceptos básicos de programación',
    estado: 'RECHAZADA',
    fechaPropuesta: fecha(20),
    revisiones: [
      {
        agente: agenteMx.id,
        etapa: 'REVISION_ORIGEN',
        decision: 'RECHAZADA',
        fecha: dia(-3, 9),
        comentario:
          'Falta detallar los temas y el calendario; corrige la propuesta y vuelve a enviarla.',
      },
    ],
  });

  // Rechazada por el agente de destino (con las dos etapas registradas)
  await crearSolicitud({
    origen: A.miguel,
    destino: B.valeria,
    titulo: 'Clase espejo: Comercio exterior',
    objetivo: 'Analizar los tratados comerciales vigentes',
    estado: 'RECHAZADA',
    fechaPropuesta: fecha(26),
    revisiones: [
      { agente: agenteMx.id, etapa: 'REVISION_ORIGEN', decision: 'APROBADA', fecha: dia(-6, 9), comentario: 'Aprobada' },
      {
        agente: agenteCo.id,
        etapa: 'REVISION_DESTINO',
        decision: 'RECHAZADA',
        fecha: dia(-5, 10),
        comentario: 'No hay docente disponible en el periodo propuesto.',
      },
    ],
  });

  fs.writeFileSync(
    path.join(__dirname, 'demo-clases-ids.json'),
    JSON.stringify(ids, null, 2),
  );

  console.log('--- SIMULACIÓN CREADA ---');
  console.log('proyectos nuevos:', ids.proyectos.length, '→', ids.proyectos.join(', '));
  console.log('solicitudes nuevas:', ids.solicitudes.length, '→', ids.solicitudes.join(', '));
  console.log('sesiones:', ids.sesiones.length, '| evidencias:', ids.evidencias.length);
  console.log('ids guardados en scripts/demo-clases-ids.json');
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
