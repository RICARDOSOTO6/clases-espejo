#!/usr/bin/env node
/**
 * Prueba de restauración: carga un respaldo en una base temporal y comprueba
 * que los totales coinciden con la base de la que salió.
 *
 * Uso (desde `backend`):
 *   npm run probar-restauracion                 # usa el respaldo más reciente
 *   npm run probar-restauracion -- --nuevo      # respalda ahora y prueba ese
 *   npm run probar-restauracion -- --archivo <base.dump>
 *   npm run probar-restauracion -- --mantener   # no borra la base temporal
 *   npm run probar-restauracion -- --solo-filas # no compara la huella
 *   npm run probar-restauracion -- --sin-origen # solo prueba que carga
 *   npm run probar-restauracion -- --sin-anotar # no escribe en la guía
 *
 * Qué hace, en este orden:
 *   1. Busca el `base.dump` más reciente en `backend/respaldos/` (o el que se le
 *      diga). Si no hay ninguno, hace uno nuevo con `respaldo.js --sin-archivos`.
 *   2. Crea una base temporal `clasesconjuntas_restauracion_<fecha>`.
 *   3. La restaura con `pg_restore` y exige que no falle ningún objeto.
 *   4. Cuenta las filas de cada tabla en el origen y en la restauración, y
 *      compara también una huella `md5` del contenido de cada tabla (la huella
 *      se puede desactivar con `--solo-filas`).
 *   5. Borra la base temporal (salvo `--mantener`) y anota la fecha y el
 *      resultado en `docs/guias/respaldo-y-restauracion.md`, entre los
 *      marcadores `registro-restauraciones`.
 *
 * Si la base de origen cambió después del respaldo, los totales no coinciden y
 * lo dice: un respaldo solo prueba lo que tenía dentro cuando se hizo. Para una
 * prueba limpia, `--nuevo`.
 *
 * No toca la base de trabajo: solo la lee. La restauración va a otra base.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(RAIZ, '.env'), quiet: true });

const GUIA = path.join(RAIZ, '..', 'docs', 'guias', 'respaldo-y-restauracion.md');
const MARCA_INICIO = '<!-- registro-restauraciones -->';
const MARCA_FIN = '<!-- /registro-restauraciones -->';
const PREFIJO_BASE_TEMPORAL = 'clasesconjuntas_restauracion_';

function argumentos(argv) {
  const opciones = {
    archivo: null,
    carpeta: null,
    nuevo: false,
    mantener: false,
    soloFilas: false,
    sinOrigen: false,
    sinAnotar: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--archivo') opciones.archivo = argv[++i];
    else if (a === '--carpeta') opciones.carpeta = argv[++i];
    else if (a === '--nuevo') opciones.nuevo = true;
    else if (a === '--mantener') opciones.mantener = true;
    else if (a === '--solo-filas') opciones.soloFilas = true;
    else if (a === '--sin-origen') opciones.sinOrigen = true;
    else if (a === '--sin-anotar') opciones.sinAnotar = true;
    else if (a === '--ayuda' || a === '-h') {
      console.log(
        'Uso: npm run probar-restauracion [-- --nuevo | --archivo <base.dump> | --carpeta <carpeta>]',
      );
      console.log(
        '     [--mantener] [--solo-filas] [--sin-origen] [--sin-anotar]',
      );
      process.exit(0);
    } else {
      console.error(`Opción desconocida: ${a}`);
      process.exit(2);
    }
  }
  if (opciones.nuevo && (opciones.archivo || opciones.carpeta)) {
    console.error('«--nuevo» no se combina con «--archivo» ni con «--carpeta».');
    process.exit(2);
  }
  return opciones;
}

function ejecutable(nombre) {
  const variable = nombre.toUpperCase();
  const candidatos = [
    process.env[variable],
    nombre,
    `C:\\Program Files\\PostgreSQL\\17\\bin\\${nombre}.exe`,
    `C:\\Program Files\\PostgreSQL\\16\\bin\\${nombre}.exe`,
    `C:\\Program Files\\PostgreSQL\\15\\bin\\${nombre}.exe`,
    `C:\\Program Files (x86)\\PostgreSQL\\17\\bin\\${nombre}.exe`,
  ].filter(Boolean);
  for (const candidato of candidatos) {
    try {
      if (candidato === nombre) {
        const r = spawnSync(candidato, ['--version'], {
          stdio: 'ignore',
          shell: false,
        });
        if (!r.error) return candidato;
      } else if (fs.existsSync(candidato)) {
        return candidato;
      }
    } catch {
      // Probar el siguiente candidato.
    }
  }
  throw new Error(
    `No encuentro ${nombre}. Instala PostgreSQL o define ${variable} con la ruta completa.`,
  );
}

function conexion() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en backend/.env');
  const parsed = new URL(url);
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error('DATABASE_URL no es una URL de PostgreSQL');
  }
  const dbname = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!dbname) throw new Error('DATABASE_URL no trae el nombre de la base');
  return {
    dbname,
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    sslmode: parsed.searchParams.get('sslmode'),
  };
}

function entorno() {
  const db = conexion();
  const env = { ...process.env, PGPASSWORD: db.password };
  if (db.sslmode) env.PGSSLMODE = db.sslmode;
  return env;
}

function psql(base, sql) {
  const db = conexion();
  // La consulta y su salida van por archivo, no por tubería: en entornos
  // restringidos (el sandbox de este proyecto, por ejemplo) capturar la salida
  // de un proceso secundario falla con EPERM. Un archivo temporal funciona en
  // todas partes y deja el SQL a la vista si hay que depurar.
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'restauracion-'));
  const archivoSql = path.join(carpeta, 'consulta.sql');
  const archivoSalida = path.join(carpeta, 'salida.txt');
  fs.writeFileSync(archivoSql, `${sql}\n`, 'utf8');
  try {
    const resultado = spawnSync(
      ejecutable('psql'),
      [
        `--host=${db.host}`,
        `--port=${db.port}`,
        `--username=${db.user}`,
        `--dbname=${base}`,
        '--no-align',
        '--tuples-only',
        '--field-separator=|',
        `--file=${archivoSql}`,
        `--output=${archivoSalida}`,
      ],
      { env: entorno(), stdio: 'inherit' },
    );
    if (resultado.error) throw resultado.error;
    if (resultado.status !== 0) {
      throw new Error(`psql falló en «${base}» (código ${resultado.status}).`);
    }
    return fs.readFileSync(archivoSalida, 'utf8');
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
}

function tablasDe(base) {
  return psql(
    base,
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;",
  )
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);
}

/** Filas y huella de contenido de cada tabla, en una sola consulta. */
function medidasDe(base, tablas, conHuella) {
  if (tablas.length === 0) {
    throw new Error(`La base «${base}» no tiene tablas en el esquema public.`);
  }
  const partes = tablas.map((tabla) => {
    const nombre = tabla.replace(/"/g, '""');
    const huella = conHuella
      ? `(SELECT md5(string_agg(md5(x::text), '|' ORDER BY md5(x::text))) FROM "${nombre}" x)`
      : 'NULL';
    return `SELECT '${tabla.replace(/'/g, "''")}' AS tabla, (SELECT count(*) FROM "${nombre}") AS filas, ${huella} AS huella`;
  });
  const salida = psql(
    base,
    `${partes.join('\nUNION ALL\n')}\nORDER BY tabla;`,
  );
  const medidas = new Map();
  for (const linea of salida.split(/\r?\n/)) {
    if (!linea.trim()) continue;
    const [tabla, filas, huella] = linea.split('|');
    medidas.set(tabla, {
      filas: Number(filas),
      huella: huella === '' ? null : huella,
    });
  }
  return medidas;
}

function comparar(tablasOrigen, tablasDestino, medidasOrigen, medidasDestino) {
  const faltanEnDestino = tablasOrigen.filter(
    (tabla) => !medidasDestino.has(tabla),
  );
  const sobranEnDestino = tablasDestino.filter(
    (tabla) => !medidasOrigen.has(tabla),
  );
  const diferentes = [];
  for (const [tabla, origen] of medidasOrigen) {
    const destino = medidasDestino.get(tabla);
    if (!destino) continue;
    if (origen.filas !== destino.filas || origen.huella !== destino.huella) {
      diferentes.push({ tabla, origen, destino });
    }
  }
  const sumarFilas = (mapa) =>
    [...mapa.values()].reduce((total, medida) => total + medida.filas, 0);
  return {
    faltanEnDestino,
    sobranEnDestino,
    diferentes,
    tablasOrigen: medidasOrigen.size,
    tablasDestino: medidasDestino.size,
    filasOrigen: sumarFilas(medidasOrigen),
    filasDestino: sumarFilas(medidasDestino),
  };
}

function carpetaMasReciente() {
  const carpeta = path.join(RAIZ, 'respaldos');
  if (!fs.existsSync(carpeta)) return null;
  const candidatas = fs
    .readdirSync(carpeta, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => path.join(carpeta, entrada.name))
    .filter((ruta) => fs.existsSync(path.join(ruta, 'base.dump')))
    .sort();
  return candidatas.length > 0 ? candidatas[candidatas.length - 1] : null;
}

function respaldarAhora() {
  console.log(
    'Haciendo un respaldo nuevo con `respaldo.js --sin-archivos` para probarlo…',
  );
  const resultado = spawnSync(
    process.execPath,
    [path.join(__dirname, 'respaldo.js'), '--sin-archivos'],
    { stdio: 'inherit', env: process.env },
  );
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error('El respaldo falló; no hay nada que probar.');
  }
}

function leerManifiesto(carpeta) {
  const archivo = path.join(carpeta, 'respaldo.json');
  if (!fs.existsSync(archivo)) return null;
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch {
    return null;
  }
}

function resolverVolcado(opciones) {
  if (opciones.archivo) {
    const dump = path.resolve(opciones.archivo);
    if (!fs.existsSync(dump)) {
      throw new Error(`No encuentro el volcado: ${dump}`);
    }
    return { dump, carpeta: path.dirname(dump), manifiesto: null };
  }

  let carpeta = null;
  if (opciones.nuevo) {
    respaldarAhora();
    carpeta = carpetaMasReciente();
  } else {
    carpeta = opciones.carpeta
      ? path.resolve(opciones.carpeta)
      : carpetaMasReciente();
    if (!carpeta) {
      respaldarAhora();
      carpeta = carpetaMasReciente();
    }
  }
  if (!carpeta) throw new Error('No hay ningún respaldo del que tomar el volcado.');
  const dump = path.join(carpeta, 'base.dump');
  if (!fs.existsSync(dump)) {
    throw new Error(`La carpeta «${carpeta}» no tiene base.dump.`);
  }
  return { dump, carpeta, manifiesto: leerManifiesto(carpeta) };
}

function crearBase(nombre) {
  const db = conexion();
  const resultado = spawnSync(
    ejecutable('createdb'),
    [
      `--host=${db.host}`,
      `--port=${db.port}`,
      `--username=${db.user}`,
      nombre,
    ],
    { env: entorno(), stdio: 'inherit' },
  );
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`No se pudo crear la base «${nombre}».`);
  }
}

function borrarBase(nombre) {
  const db = conexion();
  const resultado = spawnSync(
    ejecutable('dropdb'),
    [
      '--force',
      '--if-exists',
      `--host=${db.host}`,
      `--port=${db.port}`,
      `--username=${db.user}`,
      nombre,
    ],
    { env: entorno(), stdio: 'inherit' },
  );
  if (resultado.error || resultado.status !== 0) {
    console.warn(`No se pudo borrar la base temporal «${nombre}»: bórrala a mano.`);
  }
}

function restaurar(dump, nombre) {
  const db = conexion();
  const resultado = spawnSync(
    ejecutable('pg_restore'),
    [
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      `--dbname=${nombre}`,
      `--host=${db.host}`,
      `--port=${db.port}`,
      `--username=${db.user}`,
      dump,
    ],
    { env: entorno(), stdio: 'inherit' },
  );
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`pg_restore terminó con código ${resultado.status}`);
  }
}

function marcaDeTiempo() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function fechaLegible() {
  const ahora = new Date();
  const dia = String(ahora.getDate()).padStart(2, '0');
  const mes = ahora.toLocaleString('es-MX', { month: 'short' }).replace('.', '');
  const hora = ahora.toTimeString().slice(0, 5);
  return `${dia}-${mes}-${ahora.getFullYear()} ${hora}`;
}

/** Añade una fila al registro de la guía, entre los marcadores. */
function anotarEnGuia(fila) {
  if (!fs.existsSync(GUIA)) {
    console.warn(`No encuentro la guía (${GUIA}); no se anota el resultado.`);
    return;
  }
  const texto = fs.readFileSync(GUIA, 'utf8');
  const fin = texto.indexOf(MARCA_FIN);
  if (fin < 0 || !texto.includes(MARCA_INICIO)) {
    console.warn(
      'La guía no tiene los marcadores «registro-restauraciones»; no se anota el resultado.',
    );
    return;
  }
  fs.writeFileSync(GUIA, `${texto.slice(0, fin)}${fila}\n${texto.slice(fin)}`);
  console.log(
    `Resultado anotado en ${path.relative(RAIZ, GUIA)} (sección «Registro de las pruebas de restauración»).`,
  );
}

function main() {
  const opciones = argumentos(process.argv.slice(2));
  const { dump, carpeta, manifiesto } = resolverVolcado(opciones);
  const db = conexion();
  const origen = opciones.sinOrigen ? null : (manifiesto?.base ?? db.dbname);
  const destino = `${PREFIJO_BASE_TEMPORAL}${marcaDeTiempo()}`;
  const relativo = path.relative(RAIZ, dump);

  console.log(`Volcado: ${relativo} (${fs.statSync(dump).size} bytes)`);
  if (manifiesto?.fecha) console.log(`Hecho el: ${manifiesto.fecha}`);
  if (origen) console.log(`Base de origen: ${origen}`);
  console.log(`Base temporal: ${destino}`);

  let comparacion = null;
  let error = null;
  crearBase(destino);
  try {
    restaurar(dump, destino);
    const tablasDestino = tablasDe(destino);
    const medidasDestino = medidasDe(
      destino,
      tablasDestino,
      !opciones.soloFilas,
    );

    if (origen) {
      const tablasOrigen = tablasDe(origen);
      const medidasOrigen = medidasDe(
        origen,
        tablasOrigen,
        !opciones.soloFilas,
      );
      comparacion = comparar(
        tablasOrigen,
        tablasDestino,
        medidasOrigen,
        medidasDestino,
      );
    } else {
      console.log(
        `Restauración correcta: ${medidasDestino.size} tablas cargadas (sin base de origen con la que comparar).`,
      );
    }
  } catch (fallo) {
    error = fallo;
  } finally {
    if (opciones.mantener) {
      console.log(`La base temporal «${destino}» se queda para inspeccionarla.`);
    } else {
      borrarBase(destino);
    }
  }

  if (error) {
    console.error(`❌ Prueba de restauración fallida: ${error.message}`);
    if (!opciones.sinAnotar) {
      anotarEnGuia(
        `| ${fechaLegible()} | \`${relativo}\` | — | — | ❌ falló: ${String(error.message).replace(/\|/g, '/').slice(0, 120)} |`,
      );
    }
    process.exitCode = 1;
    return;
  }

  let resultado;
  let fila;
  if (!comparacion) {
    resultado = 'solo carga';
    fila = `| ${fechaLegible()} | \`${relativo}\` | ${'—'} | ${'—'} | ✅ carga correcta (sin comparar) |`;
  } else {
    const igual =
      comparacion.diferentes.length === 0 &&
      comparacion.faltanEnDestino.length === 0 &&
      comparacion.sobranEnDestino.length === 0;
    resultado = igual ? 'iguales' : 'diferencias';

    console.log('');
    console.log(
      `Tablas: ${comparacion.tablasOrigen} en el origen / ${comparacion.tablasDestino} en la restauración`,
    );
    console.log(
      `Filas: ${comparacion.filasOrigen} / ${comparacion.filasDestino}`,
    );
    if (opciones.soloFilas) {
      console.log('Huella de contenido: no comparada (--solo-filas).');
    }
    if (comparacion.faltanEnDestino.length > 0) {
      console.log(
        `Faltan en la restauración: ${comparacion.faltanEnDestino.join(', ')}`,
      );
    }
    if (comparacion.sobranEnDestino.length > 0) {
      console.log(
        `Sobran en la restauración: ${comparacion.sobranEnDestino.join(', ')}`,
      );
    }
    if (comparacion.diferentes.length > 0) {
      console.log('Tablas que no coinciden:');
      for (const filaTabla of comparacion.diferentes) {
        const huella =
          filaTabla.origen.huella === filaTabla.destino.huella
            ? 'filas'
            : 'filas y contenido';
        console.log(
          `  ${filaTabla.tabla}: ${filaTabla.origen.filas} / ${filaTabla.destino.filas} (${huella})`,
        );
      }
    }
    console.log(
      `Resultado: ${igual ? '✅ totales iguales' : '❌ hay diferencias'}`,
    );
    if (!igual) {
      console.log(
        'Si la base de origen se usó después de hacer el respaldo, es lo esperado:',
      );
      console.log(
        'vuelve a probar con «--nuevo» para respaldar y restaurar el mismo estado.',
      );
    }
    fila = `| ${fechaLegible()} | \`${relativo}\` | ${comparacion.tablasOrigen} | ${comparacion.filasOrigen} | ${igual ? '✅ totales iguales' : '❌ diferencias'} |`;
  }

  if (!opciones.sinAnotar) {
    anotarEnGuia(fila);
  }
  process.exitCode = resultado === 'diferencias' ? 1 : 0;
}

try {
  main();
} catch (error) {
  console.error(`No se pudo probar la restauración: ${error.message}`);
  process.exitCode = 1;
}
