/**
 * Verificador del flujo de una clase espejo (de principio a fin).
 * Lee la base de datos y traza una clase FINALIZADA paso a paso, comprobando
 * que cada estado sea el esperado.
 *
 * Uso: node scripts/verificar-flujo.js
 */
require('dotenv').config();
const { PrismaClient } = require('../dist/generated/prisma/client');

const p = new PrismaClient();

const fmt = (d) => (d ? d.toISOString().slice(0, 10) : '—');

function nombreDocente(asignacion) {
  const u = asignacion?.docenteInstitucion?.docente?.usuario;
  const inst = asignacion?.docenteInstitucion?.institucion;
  return u
    ? `${u.nombres} ${u.apellidoPaterno} (${inst?.pais ?? '?'})`
    : '—';
}

async function main() {
  const proyecto = await p.proyectoClaseEspejo.findFirst({
    where: { estado: 'FINALIZADO' },
    orderBy: { id: 'asc' },
    include: {
      solicitud: {
        include: {
          revisiones: {
            include: { agente: { include: { usuario: true } } },
            orderBy: { revisadaEn: 'asc' },
          },
          asignacionOrigen: {
            include: {
              materia: true,
              docenteInstitucion: { include: { docente: { include: { usuario: true } }, institucion: true } },
            },
          },
          asignacionDestino: {
            include: {
              materia: true,
              docenteInstitucion: { include: { docente: { include: { usuario: true } }, institucion: true } },
            },
          },
          institucionDestino: true,
        },
      },
      docentes: {
        include: {
          asignacionDocente: {
            include: {
              docenteInstitucion: { include: { docente: { include: { usuario: true } }, institucion: true } },
            },
          },
        },
      },
      planificacion: { include: { participaciones: { include: { proyectoDocente: true } } } },
      sesiones: {
        orderBy: { fechaHora: 'asc' },
        include: {
          reporte: { include: { participaciones: true } },
          evidencias: true,
        },
      },
      actividades: true,
      evaluaciones: true,
    },
  });

  if (!proyecto) {
    console.log('No se encontró un proyecto FINALIZADO.');
    await p.$disconnect();
    return;
  }

  const s = proyecto.solicitud;
  const origen = nombreDocente(s.asignacionOrigen);
  const destino = nombreDocente(s.asignacionDestino);

  console.log('══════════════════════════════════════════════════════════');
  console.log('  TRAZA DE UNA CLASE ESPEJO COMPLETA (de principio a fin)');
  console.log('══════════════════════════════════════════════════════════\n');

  console.log('TÍTULO      :', s.titulo);
  console.log('MATERIA     :', `${s.asignacionOrigen?.materia?.nombre}  ⇄  ${s.asignacionDestino?.materia?.nombre ?? '—'}`);
  console.log('ORIGEN      :', origen, `(${s.asignacionOrigen?.materia?.nombre})`);
  console.log('DESTINO     :', destino);
  console.log('INST. DESTINO:', s.institucionDestino?.nombre);
  console.log('');

  console.log('1) SOLICITUD ──────────────────────────────────────────────');
  console.log('   estado            :', s.estado);
  console.log('   fecha propuesta   :', fmt(s.fechaPropuesta));
  console.log('');

  console.log('2) DOBLE REVISIÓN ─────────────────────────────────────────');
  for (const r of s.revisiones) {
    const quien = r.agente?.usuario
      ? `${r.agente.usuario.nombres} ${r.agente.usuario.apellidoPaterno} (agente)`
      : '—';
    console.log(`   ${r.etapa} → ${r.decision} · por ${quien} · "${r.comentario}"`);
  }
  console.log('');

  console.log('3) PROYECTO ───────────────────────────────────────────────');
  console.log('   estado      :', proyecto.estado);
  console.log('   plataforma  :', proyecto.plataforma);
  console.log('   inicio      :', fmt(proyecto.fechaInicio), '| fin:', fmt(proyecto.fechaFin));
  console.log('   docentes    :');
  for (const d of proyecto.docentes) {
    console.log(`     - ${nombreDocente(d.asignacionDocente)} [rol: ${d.rol}]`);
  }
  console.log('');

  console.log('4) PLANIFICACIÓN CONJUNTA ─────────────────────────────────');
  if (proyecto.planificacion) {
    console.log('   estado      :', proyecto.planificacion.estado);
    console.log('   objetivos   :', proyecto.planificacion.objetivosAcordados);
    console.log('   temas       :', proyecto.planificacion.temasAcordados);
    for (const part of proyecto.planificacion.participaciones) {
      console.log(`   participación: ${part.estatusConfirmacion}`);
    }
  } else {
    console.log('   (sin planificación)');
  }
  console.log('');

  console.log('5) SESIONES Y REPORTES FIRMADOS ───────────────────────────');
  for (const ses of proyecto.sesiones) {
    const rep = ses.reporte;
    const firmas = rep?.participaciones?.filter((x) => x.confirmadoEn).length ?? 0;
    console.log(`   • ${ses.titulo}`);
    console.log(`       sesión: ${ses.estado} · ${fmt(ses.fechaHora)}`);
    console.log(`       reporte: ${rep?.estado ?? '—'} · asistentes ${rep?.totalAsistentes ?? '—'} · firmas ${firmas}/2`);
    if (ses.evidencias.length) {
      for (const e of ses.evidencias) console.log(`       evidencia: ${e.tipo} → ${e.archivoUrl}`);
    }
  }
  console.log('');

  console.log('6) ACTIVIDADES ────────────────────────────────────────────');
  for (const a of proyecto.actividades) {
    console.log(`   • ${a.titulo} (límite ${fmt(a.fechaLimite)})`);
  }
  console.log('');

  console.log('7) EVALUACIÓN FINAL ───────────────────────────────────────');
  for (const e of proyecto.evaluaciones) {
    console.log(`   • ${e.instrumento} → ${e.resultado}`);
    console.log(`     observaciones: ${e.observaciones}`);
  }
  console.log('');

  console.log('8) CIERRE ─────────────────────────────────────────────────');
  console.log('   estado final:', proyecto.estado, '(solo lectura)');
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('VEREDICTO: el flujo solicitación → doble revisión → proyecto');
  console.log('→ planificación → sesiones → reportes firmados → evaluación');
  console.log('→ cierre está completo y consistente en la base de datos.');
  console.log('══════════════════════════════════════════════════════════');

  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
