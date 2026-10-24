#!/usr/bin/env node
/**
 * Restauración de un respaldo hecho con `respaldo.js`.
 *
 * Uso (desde `backend`):
 *   npm run restauracion -- --carpeta respaldos/2026... --destino clasesconjuntasbd_restauracion --si
 *   npm run restauracion -- --archivo respaldos/.../base.dump --destino base_test --si
 *
 * Es destructiva: `pg_restore --clean` borra los objetos que estén en el
 * volcado. Por eso exige `--si`, no permite el mismo nombre de base que el
 * respaldo y, si el destino no parece de prueba, exige `--forzar`.
 *
 * No crea la base de destino: debe existir vacía. No borra archivos que ya
 * estén en `uploads/`; con `--archivos` copia los del respaldo sin pisar.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const envPath = path.join(RAIZ, '.env');
require('dotenv').config({ path: envPath, quiet: true });

function ayuda() {
  console.log(
    'Uso: npm run restauracion -- --carpeta <carpeta> --destino <base> --si [--archivos] [--forzar]',
  );
  console.log(
    '     npm run restauracion -- --archivo <base.dump> --destino <base> --si [--forzar]',
  );
}

function argumentos(argv) {
  const opciones = {
    carpeta: null,
    archivo: null,
    destino: null,
    si: false,
    archivos: false,
    forzar: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--carpeta') opciones.carpeta = argv[++i];
    else if (a === '--archivo') opciones.archivo = argv[++i];
    else if (a === '--destino') opciones.destino = argv[++i];
    else if (a === '--si') opciones.si = true;
    else if (a === '--archivos') opciones.archivos = true;
    else if (a === '--forzar') opciones.forzar = true;
    else if (a === '--ayuda' || a === '-h') {
      ayuda();
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

function conexion() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en backend/.env');
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    sslmode: parsed.searchParams.get('sslmode'),
  };
}

function esBaseDePrueba(nombre) {
  return /(_test|_demo|_restauracion|_prueba|_respaldo)$/i.test(nombre);
}

function main() {
  const opciones = argumentos(process.argv.slice(2));
  if (!opciones.destino) {
    ayuda();
    throw new Error('Falta --destino');
  }
  if (!opciones.si) {
    throw new Error(
      'La restauración borra objetos de la base de destino. Repite con --si si es lo que quieres.',
    );
  }

  let dump = opciones.archivo;
  let manifiesto = null;
  if (opciones.carpeta) {
    const carpeta = path.resolve(opciones.carpeta);
    const archivoManifiesto = path.join(carpeta, 'respaldo.json');
    if (fs.existsSync(archivoManifiesto)) {
      manifiesto = JSON.parse(fs.readFileSync(archivoManifiesto, 'utf8'));
    }
    dump = path.join(carpeta, 'base.dump');
  }
  if (!dump || !fs.existsSync(dump)) {
    throw new Error(`No encuentro el volcado: ${dump ?? '(sin --carpeta/--archivo)'}`);
  }

  if (manifiesto?.base === opciones.destino) {
    throw new Error(
      'El destino es la misma base que se respaldó. Restaura en otra base.',
    );
  }
  if (!esBaseDePrueba(opciones.destino) && !opciones.forzar) {
    throw new Error(
      `«${opciones.destino}» no parece una base de prueba. Si de verdad quieres restaurar ahí, añade --forzar.`,
    );
  }

  const db = conexion();
  const pgRestore = ejecutable('pg_restore');
  const args = [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    `--dbname=${opciones.destino}`,
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--username=${db.user}`,
    dump,
  ];
  const env = { ...process.env, PGPASSWORD: db.password };
  if (db.sslmode) env.PGSSLMODE = db.sslmode;

  console.log(
    `Restaurando ${path.basename(dump)} en «${opciones.destino}» (se borrarán objetos de esa base)…`,
  );
  const resultado = spawnSync(pgRestore, args, { env, stdio: 'inherit' });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`pg_restore terminó con código ${resultado.status}`);
  }

  if (opciones.archivos && manifiesto?.archivos) {
    const carpeta = path.resolve(opciones.carpeta);
    const origen = path.join(carpeta, manifiesto.archivos);
    const destino = path.join(RAIZ, 'uploads');
    if (fs.existsSync(origen)) {
      fs.mkdirSync(destino, { recursive: true });
      fs.cpSync(origen, destino, {
        recursive: true,
        force: false,
        errorOnExist: false,
      });
      console.log(`Archivos copiados desde ${origen} (sin pisar los existentes).`);
    } else {
      console.warn(`El respaldo dice tener archivos, pero no está ${origen}.`);
    }
  }

  console.log('Restauración terminada. Comprueba el login y los certificados.');
}

try {
  main();
} catch (error) {
  console.error(`No se pudo restaurar: ${error.message}`);
  process.exit(1);
}
