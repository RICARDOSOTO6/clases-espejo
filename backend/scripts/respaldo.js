#!/usr/bin/env node
/**
 * Respaldo de la base y de los archivos subidos.
 *
 * Uso (desde `backend`):
 *   npm run respaldo
 *   npm run respaldo -- --salida C:\respaldos\clase-real
 *   npm run respaldo -- --sin-archivos
 *
 * Deja una carpeta con el volcado de PostgreSQL (`base.dump`), la copia de
 * `uploads/` y un `respaldo.json` con los datos necesarios para restaurar.
 * No toca la base: solo lee.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const envPath = path.join(RAIZ, '.env');
require('dotenv').config({ path: envPath, quiet: true });

function argumentos(argv) {
  const opciones = { sinArchivos: false, salida: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--sin-archivos') opciones.sinArchivos = true;
    else if (a === '--salida') opciones.salida = argv[++i];
    else if (a === '--ayuda' || a === '-h') {
      console.log(
        'Uso: npm run respaldo [-- --salida <carpeta>] [-- --sin-archivos]',
      );
      process.exit(0);
    } else {
      console.error(`Opción desconocida: ${a}`);
      process.exit(2);
    }
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

function datosDeConexion() {
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

function marcaDeTiempo() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function tamanoDe(ruta) {
  if (!fs.existsSync(ruta)) return 0;
  const stat = fs.statSync(ruta);
  if (!stat.isDirectory()) return stat.size;
  let total = 0;
  for (const entrada of fs.readdirSync(ruta, { withFileTypes: true })) {
    total += tamanoDe(path.join(ruta, entrada.name));
  }
  return total;
}

function main() {
  const opciones = argumentos(process.argv.slice(2));
  const conexion = datosDeConexion();
  const carpeta =
    opciones.salida ??
    path.join(RAIZ, 'respaldos', `${marcaDeTiempo()}_${conexion.dbname}`);
  fs.mkdirSync(carpeta, { recursive: true });

  const dump = path.join(carpeta, 'base.dump');
  const pgDump = ejecutable('pg_dump');
  const args = [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    `--file=${dump}`,
    `--host=${conexion.host}`,
    `--port=${conexion.port}`,
    `--username=${conexion.user}`,
    `--dbname=${conexion.dbname}`,
  ];
  const env = { ...process.env, PGPASSWORD: conexion.password };
  if (conexion.sslmode) env.PGSSLMODE = conexion.sslmode;

  console.log(`Respaldando ${conexion.dbname} en ${carpeta}…`);
  const resultado = spawnSync(pgDump, args, { env, stdio: 'inherit' });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`pg_dump terminó con código ${resultado.status}`);
  }

  let archivos = null;
  if (!opciones.sinArchivos) {
    const origen = path.join(RAIZ, 'uploads');
    if (fs.existsSync(origen)) {
      const destino = path.join(carpeta, 'uploads');
      fs.cpSync(origen, destino, { recursive: true });
      archivos = 'uploads';
    } else {
      console.log('No hay carpeta uploads: se respalda solo la base.');
    }
  }

  const manifiesto = {
    fecha: new Date().toISOString(),
    base: conexion.dbname,
    archivoBase: 'base.dump',
    archivos,
    tamanoBase: fs.statSync(dump).size,
    tamanoArchivos: archivos ? tamanoDe(path.join(carpeta, archivos)) : 0,
    version: 1,
  };
  fs.writeFileSync(
    path.join(carpeta, 'respaldo.json'),
    JSON.stringify(manifiesto, null, 2),
    'utf8',
  );

  console.log('Respaldo terminado.');
  console.log(`  Base:   ${dump}`);
  if (archivos) console.log(`  Archivos: ${path.join(carpeta, archivos)}`);
  console.log('Guarda esta carpeta fuera del servidor.');
}

try {
  main();
} catch (error) {
  console.error(`No se pudo respaldar: ${error.message}`);
  process.exit(1);
}
