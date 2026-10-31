/**
 * Convierte el archivo JSONL de métricas en un resumen apto para el informe.
 *
 * El endpoint /metricas/rendimiento mide la instancia actual. Para conservar
 * los datos entre reinicios hay que arrancar el servidor con METRICAS_ARCHIVO
 * apuntando a un archivo; este script lo lee de ahí.
 *
 * Uso:
 *   node scripts/informe-rendimiento.js [ruta-jsonl]
 *   node scripts/informe-rendimiento.js ..\logs\rendimiento.jsonl
 */
const fs = require('node:fs');
const path = require('node:path');

const entrada = path.resolve(
  process.argv[2] || process.env.METRICAS_ARCHIVO || 'logs/rendimiento.jsonl',
);

function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

function percentil(valores, p) {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  return redondear(orden[Math.ceil((p / 100) * orden.length) - 1]);
}

if (!fs.existsSync(entrada)) {
  console.error(`No existe el archivo de métricas: ${entrada}`);
  process.exitCode = 1;
  process.exit();
}

let lineasRotas = 0;
const registros = fs
  .readFileSync(entrada, 'utf8')
  // Un archivo guardado desde Windows puede traer BOM: sin quitarlo, la primera
  // línea no se puede interpretar y se perdía una petición sin avisar.
  .replace(/^\uFEFF/, '')
  .split(/\r?\n/)
  .filter((linea) => linea.trim() !== '')
  .map((linea) => {
    try {
      return JSON.parse(linea);
    } catch {
      lineasRotas += 1;
      return null;
    }
  })
  .filter(Boolean);

if (lineasRotas > 0) {
  console.error(
    `Aviso: ${lineasRotas} línea(s) del archivo no se pudieron interpretar y se ignoran.`,
  );
}

if (registros.length === 0) {
  console.error('El archivo de métricas está vacío.');
  process.exitCode = 1;
  process.exit();
}

const porRuta = new Map();
const globales = [];
let errores4xx = 0;
let limitadas429 = 0;
let errores5xx = 0;
for (const registro of registros) {
  const duracion = Number(registro.duracionMs) || 0;
  globales.push(duracion);
  if (registro.estado >= 500) errores5xx += 1;
  else if (registro.estado === 429) limitadas429 += 1;
  else if (registro.estado >= 400) errores4xx += 1;

  const clave = `${registro.metodo} ${registro.ruta}`;
  const actual = porRuta.get(clave) || {
    peticiones: 0,
    errores4xx: 0,
    limitadas429: 0,
    errores5xx: 0,
    duraciones: [],
  };
  actual.peticiones += 1;
  if (registro.estado >= 500) actual.errores5xx += 1;
  else if (registro.estado === 429) actual.limitadas429 += 1;
  else if (registro.estado >= 400) actual.errores4xx += 1;
  actual.duraciones.push(duracion);
  porRuta.set(clave, actual);
}

const filas = [...porRuta.entries()]
  .map(([clave, valor]) => {
    const [metodo, ...resto] = clave.split(' ');
    return {
      metodo,
      ruta: resto.join(' '),
      ...valor,
      p50: percentil(valor.duraciones, 50),
      p95: percentil(valor.duraciones, 95),
      max: redondear(Math.max(...valor.duraciones)),
    };
  })
  .sort((a, b) => b.peticiones - a.peticiones);

const fechas = registros
  .map((registro) => registro.fecha)
  .filter(Boolean)
  .sort();
const lineas = [
  '# Rendimiento medido del piloto',
  '',
  `- Archivo: \`${entrada}\``,
  `- Peticiones: **${registros.length}**`,
  `- Errores 4xx: **${errores4xx}**`,
  `- Errores 5xx: **${errores5xx}**`,
  `- Desde: ${fechas[0] ?? '—'}`,
  `- Hasta: ${fechas[fechas.length - 1] ?? '—'}`,
  '',
  '## Latencias globales',
  '',
  `- Promedio: **${redondear(globales.reduce((a, b) => a + b, 0) / globales.length)} ms**`,
  `- p50: **${percentil(globales, 50)} ms**`,
  `- p95: **${percentil(globales, 95)} ms**`,
  `- p99: **${percentil(globales, 99)} ms**`,
  `- Máxima: **${redondear(Math.max(...globales))} ms**`,
  '',
  '## Rutas',
  '',
  '| Método | Ruta | Peticiones | 4xx | 429 | 5xx | p50 ms | p95 ms | máx. ms |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|',
  ...filas.map(
    (fila) =>
      `| ${fila.metodo} | ${fila.ruta} | ${fila.peticiones} | ${fila.errores4xx} | ${fila.limitadas429} | ${fila.errores5xx} | ${fila.p50} | ${fila.p95} | ${fila.max} |`,
  ),
  '',
  '> El 429 es el límite de intentos, no un error del sistema: va en su propia columna.',
  '',
  ...(filas.some((f) => f.peticiones < 30)
    ? [
        '> **Aviso:** hay rutas con menos de 30 peticiones. Sus percentiles no son fiables y no',
        '> deberían citarse; con una sola petición, p50, p95 y p99 son el mismo número.',
        '',
      ]
    : []),
  '> Son peticiones reales del piloto. No incluyen renderizado del navegador,',
  '> red del usuario ni latencia de correo; para eso hacen falta métricas del',
  '> navegador o del proveedor. No se deben comparar con una prueba de carga.',
  '',
];

const salida = path.resolve(
  path.dirname(entrada),
  `rendimiento-informe-${new Date().toISOString().slice(0, 10)}.md`,
);
fs.writeFileSync(salida, lineas.join('\n'), 'utf8');
console.log(lineas.join('\n'));
console.log(`\nInforme guardado en: ${salida}`);
