/**
 * Resumen legible de la cobertura, para pegarlo en el registro del CI.
 *
 * Lee `coverage/coverage-summary.json` (lo genera `npm run test:cov`) y escribe
 * un resumen en Markdown: el total, el detalle por carpeta y los archivos con
 * menos cobertura. Si el archivo no existe, lo dice y termina sin error, porque
 * el paso del CI que lo llama también se ejecuta cuando las pruebas fallan.
 *
 * Uso, desde backend:
 *   node scripts/resumen-cobertura.js            # por pantalla
 *   node scripts/resumen-cobertura.js --guardar  # y deja coverage/RESUMEN.md
 */
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const ARCHIVO = join(process.cwd(), 'coverage', 'coverage-summary.json');
const GUARDAR = process.argv.includes('--guardar');

function porcentaje(valor) {
  return `${valor.total === 0 ? '—' : valor.pct}`;
}

function leerResumen() {
  if (!existsSync(ARCHIVO)) {
    return null;
  }
  return JSON.parse(readFileSync(ARCHIVO, 'utf8'));
}

function agruparPorCarpeta(entradas) {
  const carpetas = new Map();
  for (const [ruta, datos] of entradas) {
    if (ruta === 'total') continue;
    const trozos = ruta.replace(/\\/g, '/').split('/');
    const indice = trozos.indexOf('src');
    const carpeta = indice >= 0 && trozos[indice + 1] ? trozos[indice + 1] : '.';
    const fila = carpetas.get(carpeta) ?? {
      linea: 0,
      lineaCubierta: 0,
      rama: 0,
      ramaCubierta: 0,
      funcion: 0,
      funcionCubierta: 0,
      archivos: 0,
    };
    fila.linea += datos.lines.total;
    fila.lineaCubierta += datos.lines.covered;
    fila.rama += datos.branches.total;
    fila.ramaCubierta += datos.branches.covered;
    fila.funcion += datos.functions.total;
    fila.funcionCubierta += datos.functions.covered;
    fila.archivos += 1;
    carpetas.set(carpeta, fila);
  }
  return [...carpetas.entries()]
    .map(([carpeta, fila]) => ({
      carpeta,
      archivos: fila.archivos,
      lineas: fila.linea
        ? ((fila.lineaCubierta / fila.linea) * 100).toFixed(1)
        : '—',
      ramas: fila.rama
        ? ((fila.ramaCubierta / fila.rama) * 100).toFixed(1)
        : '—',
      funciones: fila.funcion
        ? ((fila.funcionCubierta / fila.funcion) * 100).toFixed(1)
        : '—',
    }))
    .sort((a, b) => Number(a.lineas) - Number(b.lineas));
}

function peoresArchivos(entradas, cuantos) {
  return entradas
    .filter(([ruta]) => ruta !== 'total')
    .map(([ruta, datos]) => {
      const trozos = ruta.replace(/\\/g, '/').split('/');
      const indice = trozos.indexOf('src');
      return {
        archivo: indice >= 0 ? trozos.slice(indice).join('/') : ruta,
        lineas: datos.lines.pct,
        lineasTotal: datos.lines.total,
      };
    })
    .filter((fila) => fila.lineasTotal > 0)
    .sort((a, b) => a.lineas - b.lineas)
    .slice(0, cuantos);
}

function main() {
  const resumen = leerResumen();
  if (!resumen) {
    console.log(
      'Sin resumen de cobertura: ejecuta antes `npm run test:cov` (genera coverage/coverage-summary.json).',
    );
    return;
  }

  const entradas = Object.entries(resumen);
  const total = resumen.total;
  const carpetas = agruparPorCarpeta(entradas);
  const peores = peoresArchivos(entradas, 12);

  const lineas = [];
  lineas.push('## Cobertura del backend');
  lineas.push('');
  lineas.push(
    `**Total:** ${porcentaje(total.lines)} % de líneas, ${porcentaje(total.statements)} % de sentencias, ${porcentaje(total.functions)} % de funciones y ${porcentaje(total.branches)} % de ramas.`,
  );
  lineas.push('');
  lineas.push('| Carpeta | Archivos | Líneas % | Ramas % | Funciones % |');
  lineas.push('| --- | ---: | ---: | ---: | ---: |');
  for (const fila of carpetas) {
    lineas.push(
      `| \`${fila.carpeta}\` | ${fila.archivos} | ${fila.lineas} | ${fila.ramas} | ${fila.funciones} |`,
    );
  }
  lineas.push('');
  lineas.push('Archivos con menos cobertura de líneas:');
  lineas.push('');
  lineas.push('| Archivo | Líneas % | Líneas |');
  lineas.push('| --- | ---: | ---: |');
  for (const fila of peores) {
    lineas.push(`| \`${fila.archivo}\` | ${fila.lineas} | ${fila.lineasTotal} |`);
  }
  lineas.push('');

  const texto = lineas.join('\n');
  console.log(texto);

  if (GUARDAR) {
    writeFileSync(join(process.cwd(), 'coverage', 'RESUMEN.md'), `${texto}\n`);
  }
}

main();
