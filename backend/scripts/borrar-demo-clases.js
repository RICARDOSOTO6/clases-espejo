/**
 * Borra la simulación creada por `seed-demo-clases.js`.
 * Lee los identificadores de `demo-clases-ids.json` y elimina en orden inverso
 * respetando las claves foráneas.
 *
 * Uso: node scripts/borrar-demo-clases.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../dist/generated/prisma/client');

const p = new PrismaClient();

async function main() {
  const archivo = path.join(__dirname, 'demo-clases-ids.json');
  if (!fs.existsSync(archivo)) {
    console.log('No hay simulación registrada (falta demo-clases-ids.json).');
    return;
  }
  const ids = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const { proyectos, solicitudes, sesiones, evidencias } = ids;

  const planificaciones = await p.planificacionConjunta.findMany({
    where: { proyectoId: { in: proyectos } },
    select: { id: true },
  });
  const planIds = planificaciones.map((x) => x.id);

  const reportes = await p.reporteClaseConjunta.findMany({
    where: { sesionId: { in: sesiones } },
    select: { id: true },
  });
  const reporteIds = reportes.map((x) => x.id);

  const r1 = await p.participacionReporte.deleteMany({
    where: { reporteClaseId: { in: reporteIds } },
  });
  const r2 = await p.reporteClaseConjunta.deleteMany({
    where: { id: { in: reporteIds } },
  });
  const r3 = await p.evidencia.deleteMany({
    where: {
      OR: [{ id: { in: evidencias } }, { proyectoId: { in: proyectos } }],
    },
  });
  const r4 = await p.sesion.deleteMany({ where: { id: { in: sesiones } } });
  const r5 = await p.actividad.deleteMany({
    where: { proyectoId: { in: proyectos } },
  });
  const r6 = await p.evaluacion.deleteMany({
    where: { proyectoId: { in: proyectos } },
  });
  const r7 = await p.participacionPlanificacion.deleteMany({
    where: { planificacionId: { in: planIds } },
  });
  const r8 = await p.planificacionConjunta.deleteMany({
    where: { id: { in: planIds } },
  });
  const r9 = await p.mensaje.deleteMany({
    where: { proyectoId: { in: proyectos } },
  });
  const r10 = await p.proyectoDocente.deleteMany({
    where: { proyectoId: { in: proyectos } },
  });
  const r11 = await p.proyectoClaseEspejo.deleteMany({
    where: { id: { in: proyectos } },
  });
  const r12 = await p.revisionSolicitud.deleteMany({
    where: { solicitudId: { in: solicitudes } },
  });
  const r13 = await p.solicitudClaseEspejo.deleteMany({
    where: { id: { in: solicitudes } },
  });

  // Archivos de evidencia de demostración
  const uploadsDir = path.join(process.cwd(), 'uploads');
  for (const nombre of [
    'demo-evidencia-1.pdf',
    'demo-evidencia-2.pdf',
    'demo-evidencia-3.pdf',
  ]) {
    const f = path.join(uploadsDir, nombre);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  fs.unlinkSync(archivo);

  console.log('--- SIMULACIÓN BORRADA ---');
  console.log('proyectos:', r11.count, '| solicitudes:', r13.count, '| sesiones:', r4.count);
  console.log('evidencias:', r3.count, '| actividades:', r5.count, '| evaluaciones:', r6.count);
  console.log('planificaciones:', r8.count, '| revisiones:', r12.count);
  console.log('(firmas:', r1.count, 'reportes:', r2.count, 'participaciones:', r7.count, 'mensajes:', r9.count, ')');
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
