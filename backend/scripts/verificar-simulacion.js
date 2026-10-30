/**
 * Comprueba que la simulación integral quedó completa y deja un informe
 * legible con el resultado de cada comprobación.
 *
 * Uso, desde backend:
 *   node scripts/verificar-simulacion.js [id]
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('../dist/generated/prisma/client');

const prisma = new PrismaClient();
const proyectoId = Number(process.argv[2] || 29);

function firmaPdf(ruta) {
  if (!fs.existsSync(ruta)) return false;
  const cabecera = Buffer.alloc(4);
  const descriptor = fs.openSync(ruta, 'r');
  fs.readSync(descriptor, cabecera, 0, 4, 0);
  fs.closeSync(descriptor);
  return cabecera.toString('ascii') === '%PDF';
}

async function main() {
  const proyecto = await prisma.proyectoClaseEspejo.findUnique({
    where: { id: proyectoId },
    include: {
      solicitud: true,
      participantes: { include: { institucion: true } },
      docentes: true,
      eventos: { orderBy: { creadoEn: 'asc' } },
      cancelaciones: {
        include: { votos: true, solicitadaPor: true },
        orderBy: { creadaEn: 'desc' },
      },
      sesiones: {
        orderBy: { fechaHora: 'asc' },
        include: {
          reporte: { include: { participaciones: true } },
        },
      },
      actividades: true,
      evidencias: true,
      evaluaciones: true,
      mensajes: true,
      planificacion: {
        include: { participaciones: true, reportes: true },
      },
    },
  });
  if (!proyecto) throw new Error(`No existe el proyecto ${proyectoId}`);

  const filas = [];
  const comprobar = (nombre, valor, esperado, detalle = '') => {
    const pasa = valor === esperado;
    filas.push({
      nombre,
      resultado: pasa ? 'PASA' : 'FALLA',
      valor: String(valor),
      esperado: String(esperado),
      detalle,
    });
    if (!pasa) {
      throw new Error(
        `Comprobación fallida: ${nombre} = ${valor}; esperado ${esperado}`,
      );
    }
  };

  const activas = proyecto.participantes.filter((p) =>
    ['APROBADA', 'CONGELADA'].includes(p.estado),
  );
  const retiradas = proyecto.participantes.filter(
    (p) => p.estado === 'RETIRADA',
  );
  const cancelacion = proyecto.cancelaciones[0];
  const tiposEvento = new Set(proyecto.eventos.map((e) => e.tipo));
  const reportes = proyecto.sesiones.filter(
    (s) => s.reporte?.estado === 'CONFIRMADO',
  );
  const reportesCompletos = reportes.filter(
    (s) => s.reporte.participaciones.length === proyecto.docentes.length,
  );
  const carpeta = path.resolve(__dirname, '..', '..', 'release');
  const acta = path.join(carpeta, `simulacion-clase-${proyecto.id}-acta.pdf`);
  const expediente = path.join(
    carpeta,
    `simulacion-clase-${proyecto.id}-expediente.pdf`,
  );

  comprobar('Estado del proyecto', proyecto.estado, 'FINALIZADO');
  comprobar('Instituciones participantes', proyecto.participantes.length, 4);
  comprobar('Instituciones activas al cierre', activas.length, 3);
  comprobar('Instituciones retiradas', retiradas.length, 1);
  comprobar(
    'Solicitud de cancelación',
    cancelacion?.estado ?? 'SIN SOLICITUD',
    'RECHAZADA',
    cancelacion?.motivo ?? '',
  );
  comprobar(
    'Votos de rechazo',
    cancelacion?.votos.filter((v) => v.decision === 'RECHAZADA').length ?? 0,
    1,
  );
  comprobar('Sesiones', proyecto.sesiones.length, 4);
  comprobar('Reportes de sesión confirmados', reportes.length, 4);
  comprobar(
    'Reportes con las cuatro participaciones docentes',
    reportesCompletos.length,
    4,
  );
  comprobar('Actividades', proyecto.actividades.length, 3);
  comprobar('Evidencias', proyecto.evidencias.length, 6);
  comprobar('Evaluaciones', proyecto.evaluaciones.length, 1);
  comprobar('Mensajes', proyecto.mensajes.length, 4);
  comprobar('Planificación existe', !!proyecto.planificacion, true);
  comprobar(
    'Planificación aprobada',
    proyecto.planificacion?.estado ?? '',
    'APROBADA',
  );
  comprobar(
    'Participaciones de planificación confirmadas',
    proyecto.planificacion?.participaciones.filter(
      (p) => p.estatusConfirmacion === 'CONFIRMADA',
    ).length ?? 0,
    4,
  );
  comprobar('Reporte de planificación', proyecto.planificacion?.reportes.length ?? 0, 1);
  for (const tipo of [
    'CLASE_SIMULADA',
    'CANCELACION_SOLICITADA',
    'VOTO_CANCELACION_RECHAZADO',
    'SALIDA',
  ]) {
    comprobar(`Evento ${tipo}`, tiposEvento.has(tipo), true);
  }
  comprobar('PDF acta con firma %PDF', firmaPdf(acta), true);
  comprobar('PDF expediente con firma %PDF', firmaPdf(expediente), true);

  const lineas = [
    '# Verificación de la simulación',
    '',
    `- Proyecto: **${proyecto.id}**`,
    `- Título: ${proyecto.solicitud.titulo}`,
    `- Estado: **${proyecto.estado}**`,
    `- Fecha de verificación: ${new Date().toISOString()}`,
    '',
    '| Comprobación | Resultado | Valor | Esperado |',
    '|---|---:|---|---|',
    ...filas.map(
      (fila) =>
        `| ${fila.nombre} | ${fila.resultado} | ${fila.valor} | ${fila.esperado} |`,
    ),
    '',
    '## Participantes',
    '',
    ...proyecto.participantes.map(
      (p) => `- ${p.institucion.nombre}: **${p.estado}** (${p.rol})`,
    ),
    '',
    '## Cancelación',
    '',
    cancelacion
      ? `- Estado: **${cancelacion.estado}**\n- Motivo: ${cancelacion.motivo}\n- Votos: ${cancelacion.votos
          .map((v) => `${v.decision}${v.motivo ? ` (${v.motivo})` : ''}`)
          .join('; ')}`
      : '- Sin solicitud',
    '',
    '## Archivos',
    '',
    `- Acta: ${acta}`,
    `- Expediente: ${expediente}`,
    '',
  ];
  const informe = path.join(
    carpeta,
    `simulacion-clase-${proyecto.id}-verificacion.md`,
  );
  fs.writeFileSync(informe, lineas.join('\n'), 'utf8');

  console.log(lineas.join('\n'));
  console.log(`Informe guardado en: ${informe}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
