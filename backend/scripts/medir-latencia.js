#!/usr/bin/env node
/**
 * Mide cuánto tardan las rutas que más se usan, y guarda el resultado.
 *
 * Uso (desde `backend`):
 *   npm run medir-latencia
 *   npm run medir-latencia -- --url http://localhost:3001 --peticiones 200
 *   npm run medir-latencia -- --sin-guardar
 *
 * Qué mide: `POST /auth/login`, `GET /usuarios/me`, `GET /proyectos/mios`,
 * `GET /proyectos/:id` y `GET /proyectos/:id/sesiones` — el recorrido que hace
 * una persona desde que entra hasta que abre una clase. Son peticiones **en
 * serie y con un solo usuario**: esto mide la latencia de la aplicación, no su
 * comportamiento bajo carga (eso es trabajo aparte).
 *
 * El login está limitado a 10 intentos por minuto y por IP+correo, así que se
 * mide con 9 peticiones: el login inicial, el que da el token para el resto,
 * completa las 10 permitidas. Con 9 muestras, el «p95» es prácticamente la
 * peor: se lee como una cota, no como una distribución. Si se repite la
 * medición en el mismo minuto, el login devolverá 429: hay que esperar.
 *
 * El resultado se imprime y se guarda en
 * `docs/producto/mediciones/latencia-<fecha>.md`, con la fecha, el equipo y el
 * commit medido. `--sin-guardar` solo lo imprime.
 *
 * No escribe en la base: solo hace login y consultas de lectura sobre la base
 * de demostración.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(RAIZ, '.env'), quiet: true });

const SALIDA = path.resolve(RAIZ, '..', 'docs', 'producto', 'mediciones');

function argumentos(argv) {
  const opciones = {
    url: process.env.MEDICION_URL ?? 'http://localhost:3000',
    correo: process.env.MEDICION_CORREO ?? 'sofia.gomez@clasesespejo.mx',
    password: process.env.MEDICION_PASSWORD ?? 'Demo1234',
    peticiones: 100,
    calentamiento: 3,
    guardar: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--url') opciones.url = argv[++i];
    else if (a === '--correo') opciones.correo = argv[++i];
    else if (a === '--password') opciones.password = argv[++i];
    else if (a === '--peticiones') opciones.peticiones = Number(argv[++i]);
    else if (a === '--calentamiento') opciones.calentamiento = Number(argv[++i]);
    else if (a === '--sin-guardar') opciones.guardar = false;
    else if (a === '--ayuda' || a === '-h') {
      console.log(
        'Uso: npm run medir-latencia [-- --url <url>] [--correo <correo>] [--password <clave>]',
      );
      console.log(
        '     [--peticiones <n>] [--calentamiento <n>] [--sin-guardar]',
      );
      process.exit(0);
    } else {
      console.error(`Opción desconocida: ${a}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(opciones.peticiones) || opciones.peticiones < 1) {
    console.error('«--peticiones» debe ser un número mayor que cero.');
    process.exit(2);
  }
  return opciones;
}

function base(nombre) {
  const url = process.env.DATABASE_URL;
  if (!url) return '(sin DATABASE_URL en backend/.env)';
  try {
    const parsed = new URL(url);
    const dbname = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    return dbname ? `${dbname} en ${parsed.hostname}:${parsed.port || '5432'}` : nombre;
  } catch {
    return '(DATABASE_URL no válido)';
  }
}

/** Commit actual sin lanzar `git`: leer el archivo que lo guarda. */
function commitActual() {
  try {
    const dir = path.join(RAIZ, '..', '.git');
    const cabeza = fs.readFileSync(path.join(dir, 'HEAD'), 'utf8').trim();
    if (!cabeza.startsWith('ref:')) return cabeza.slice(0, 10);
    const referencia = path.join(dir, cabeza.replace('ref:', '').trim());
    return fs.readFileSync(referencia, 'utf8').trim().slice(0, 10);
  } catch {
    return '(sin commit)';
  }
}

function fechaLocal() {
  const ahora = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())} ${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
}

function marcaArchivo() {
  const ahora = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}-${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
}

async function pedir(url, opciones = {}) {
  return fetch(url, {
    ...opciones,
    headers: { ...(opciones.headers ?? {}), 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
}

/** Una vuelta completa: devuelve milisegundos y estado HTTP. */
async function medirUna(ruta, ejecutar) {
  const inicio = process.hrtime.bigint();
  let estado = 0;
  try {
    const respuesta = await ejecutar();
    estado = respuesta.status;
    await respuesta.arrayBuffer();
  } catch (error) {
    estado = error?.name === 'TimeoutError' ? 599 : 598;
  }
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
  return { ms, estado };
}

function estadisticas(muestras) {
  const ms = muestras.map((muestra) => muestra.ms).sort((a, b) => a - b);
  const n = ms.length;
  if (n === 0) return { n: 0, medio: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const media = ms.reduce((total, valor) => total + valor, 0) / n;
  const percentil = (p) => ms[Math.min(n - 1, Math.ceil((p / 100) * n) - 1)];
  return {
    n,
    medio: media,
    p50: percentil(50),
    p95: percentil(95),
    p99: percentil(99),
    max: ms[n - 1],
  };
}

function numero(valor) {
  return valor.toLocaleString('es-MX', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

async function main() {
  const opciones = argumentos(process.argv.slice(2));
  const baseUrl = opciones.url.replace(/\/$/, '');
  const esHttps = baseUrl.startsWith('https://');

  console.log(`Midiendo ${baseUrl} …`);
  const inicioLogin = await pedir(`${baseUrl}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      correo: opciones.correo,
      password: opciones.password,
    }),
  });
  if (!inicioLogin.ok) {
    const cuerpo = await inicioLogin.text();
    throw new Error(
      `El login falló (${inicioLogin.status}). Revisa --correo/--password o que haya datos de demostración.\n${cuerpo.slice(0, 300)}`,
    );
  }
  const sesion = await inicioLogin.json();
  const cabecera = { authorization: `Bearer ${sesion.access_token}` };

  const listado = await pedir(`${baseUrl}/proyectos/mios`, { headers: cabecera });
  if (!listado.ok) {
    throw new Error(`No se pudo leer /proyectos/mios (${listado.status}).`);
  }
  const proyectos = await listado.json();
  const proyecto = Array.isArray(proyectos) && proyectos.length > 0 ? proyectos[0] : null;
  if (!proyecto?.id) {
    throw new Error(
      'La cuenta no tiene proyectos: siembra la base de demostración para poder medir /proyectos/:id.',
    );
  }

  const rutas = [
    {
      metodo: 'GET',
      ruta: '/usuarios/me',
      ejecutar: () => pedir(`${baseUrl}/usuarios/me`, { headers: cabecera }),
      peticiones: opciones.peticiones,
    },
    {
      metodo: 'GET',
      ruta: '/proyectos/mios',
      ejecutar: () => pedir(`${baseUrl}/proyectos/mios`, { headers: cabecera }),
      peticiones: opciones.peticiones,
    },
    {
      metodo: 'GET',
      ruta: `/proyectos/${proyecto.id}`,
      ejecutar: () =>
        pedir(`${baseUrl}/proyectos/${proyecto.id}`, { headers: cabecera }),
      peticiones: opciones.peticiones,
    },
    {
      metodo: 'GET',
      ruta: `/proyectos/${proyecto.id}/sesiones`,
      ejecutar: () =>
        pedir(`${baseUrl}/proyectos/${proyecto.id}/sesiones`, { headers: cabecera }),
      peticiones: opciones.peticiones,
    },
    {
      metodo: 'POST',
      ruta: '/auth/login',
      // 10 por minuto y por IP+correo (RateLimitGuard). El login inicial ya
      // gastó uno de esos 10, así que quedan 9 para medir.
      calentamiento: 0,
      ejecutar: () =>
        pedir(`${baseUrl}/auth/login`, {
          method: 'POST',
          body: JSON.stringify({
            correo: opciones.correo,
            password: opciones.password,
          }),
        }),
      peticiones: Math.min(opciones.peticiones, 9),
    },
  ];

  const filas = [];
  for (const ruta of rutas) {
    const calentamiento = ruta.calentamiento ?? opciones.calentamiento;
    for (let i = 0; i < calentamiento; i += 1) {
      await medirUna(ruta.ruta, ruta.ejecutar);
    }
    const muestras = [];
    for (let i = 0; i < ruta.peticiones; i += 1) {
      muestras.push(await medirUna(ruta.ruta, ruta.ejecutar));
    }
    const errores = muestras.filter(
      (muestra) => muestra.estado < 200 || muestra.estado >= 300,
    );
    filas.push({
      metodo: ruta.metodo,
      ruta: ruta.ruta,
      ...estadisticas(muestras),
      errores: errores.length,
      estados: [...new Set(errores.map((e) => e.estado))].join(', ') || '—',
    });
  }

  const tabla = filas
    .map(
      (fila) =>
        `| \`${fila.metodo} ${fila.ruta}\` | ${fila.n} | ${numero(fila.medio)} | ${numero(fila.p50)} | ${numero(fila.p95)} | ${numero(fila.p99)} | ${numero(fila.max)} | ${fila.errores} |`,
    )
    .join('\n');

  const entorno = [
    `- **Fecha:** ${fechaLocal()} (hora local)`,
    `- **Servidor medido:** ${baseUrl}`,
    `- **Equipo:** ${os.hostname()} · ${os.platform()} ${os.release()} ${os.arch()}`,
    `- **Procesador:** ${os.cpus()[0]?.model?.trim() ?? '(desconocido)'} (${os.cpus().length} hilos)`,
    `- **Memoria:** ${(os.totalmem() / 1e9).toFixed(1)} GB`,
    `- **Node.js:** ${process.version}`,
    `- **Base de datos:** ${base('')}`,
    `- **Commit:** ${commitActual()}`,
    `- **Conexión:** ${esHttps ? 'HTTPS' : 'HTTP'} local`,
  ].join('\n');

  const encabezado = [
    '## Resultado',
    '',
    '| Ruta | n | Media (ms) | p50 (ms) | p95 (ms) | p99 (ms) | Máx. (ms) | Errores |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    tabla,
  ].join('\n');

  const notas = [
    '',
    'Medición **en serie y con un solo usuario**: mide la latencia de la aplicación, no su comportamiento bajo carga.',
    '',
    '`POST /auth/login` se mide con 9 peticiones: el login inicial, el que da el token para el resto, completa las 10 que permite el servidor por minuto y por IP+correo (la 11 sería 429). Con 9 muestras, el p95 es prácticamente la peor: se lee como cota.',
    '',
    'Las consultas van a la base de demostración, sin escrituras.',
  ].join('\n');

  console.log('');
  console.log(encabezado);
  console.log(notas);
  console.log('');
  console.log(entorno);

  if (opciones.guardar) {
    fs.mkdirSync(SALIDA, { recursive: true });
    const destino = path.join(
      SALIDA,
      `latencia-${marcaArchivo()}.md`,
    );
    const contenido = [
      `# Tiempos de respuesta — ${fechaLocal()}`,
      '',
      entorno,
      '',
      encabezado,
      notas,
      '',
      '---',
      '',
      '> Generado con `npm run medir-latencia` (backend/scripts/medir-latencia.js). Para repetirlo, ver `docs/producto/rendimiento.md`.',
    ].join('\n');
    fs.writeFileSync(destino, `${contenido}\n`, 'utf8');
    console.log('');
    console.log(`Guardado en ${path.relative(RAIZ, destino)}`);
  }

  const fallos = filas.reduce((total, fila) => total + fila.errores, 0);
  if (fallos > 0) {
    console.error(`\nHubo ${fallos} respuestas con error; revisa los estados.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`No se pudo medir: ${error.message}`);
  process.exitCode = 1;
});
