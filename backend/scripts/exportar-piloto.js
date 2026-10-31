/**
 * Paquete de cierre del piloto.
 *
 * Reúne en una sola carpeta todo lo que hay que sacar de un servidor **antes de
 * dejarlo de pagar**: el respaldo de la base y de los archivos, las métricas
 * acumuladas, los recuentos que van al informe y un manifiesto con la fecha, la
 * versión y una huella de cada archivo.
 *
 * Uso (desde `backend`):
 *   npm run exportar-piloto
 *   npm run exportar-piloto -- --salida /root/piloto --zip
 *   npm run exportar-piloto -- --sin-archivos --sin-tablas   (solo métricas y manifiesto)
 *
 * Por defecto NO vuelca las tablas con datos personales: el informe necesita
 * recuentos, no nombres. El respaldo (`base.dump`) sí los lleva, porque es una
 * copia de seguridad; por eso el manifiesto avisa de cuáles son para archivar y
 * cuáles se pueden adjuntar.
 *
 * No escribe en la base: solo lee.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const envPath = path.join(RAIZ, '.env');

function argumentos(argv) {
  const opciones = {
    salida: '',
    sinArchivos: false,
    sinTablas: false,
    zip: false,
    jsonl: process.env.METRICAS_ARCHIVO || '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const actual = argv[i];
    if (actual === '--salida') opciones.salida = argv[++i];
    else if (actual === '--sin-archivos') opciones.sinArchivos = true;
    else if (actual === '--sin-tablas') opciones.sinTablas = true;
    else if (actual === '--zip') opciones.zip = true;
    else if (actual === '--jsonl') opciones.jsonl = argv[++i];
    else if (actual === '--ayuda' || actual === '-h') {
      console.log(
        'Uso: node scripts/exportar-piloto.js [--salida <dir>] [--zip] ' +
          '[--sin-archivos] [--sin-tablas] [--jsonl <ruta>]',
      );
      process.exit(0);
    }
  }
  return opciones;
}

/** Marca de tiempo ordenable: 2026-10-31_0945. */
function marcaDeTiempo() {
  const ahora = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return (
    `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}` +
    `_${dos(ahora.getHours())}${dos(ahora.getMinutes())}`
  );
}

/** Busca un ejecutable en PATH y en las rutas habituales de PostgreSQL. */
function buscarEjecutable(nombre) {
  const candidatos = [
    nombre,
    `C:\\Program Files\\PostgreSQL\\17\\bin\\${nombre}.exe`,
    `C:\\Program Files\\PostgreSQL\\16\\bin\\${nombre}.exe`,
    `/usr/bin/${nombre}`,
    `/usr/lib/postgresql/17/bin/${nombre}`,
    `/usr/lib/postgresql/16/bin/${nombre}`,
  ];
  for (const candidato of candidatos) {
    const prueba = spawnSync(candidato, ['--version'], { encoding: 'utf8' });
    if (prueba.status === 0) return candidato;
    if (candidato.includes('/') || candidato.includes('\\')) {
      if (fs.existsSync(candidato)) return candidato;
    }
  }
  return '';
}

function urlDeBase() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  if (!fs.existsSync(envPath)) return '';
  const linea = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('DATABASE_URL='));
  if (!linea) return '';
  return linea
    .slice(linea.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * Prisma admite parámetros que libpq no entiende: `?schema=public` hace que
 * psql aborte con «invalid URI query parameter». Se quitan antes de pasarla.
 */
function urlParaPsql(url) {
  const [base, consulta] = url.split('?');
  if (!consulta) return base;
  const quedan = consulta.split('&').filter((p) => !/^schema=/i.test(p));
  return quedan.length > 0 ? `${base}?${quedan.join('&')}` : base;
}

function huellaDe(ruta) {
  try {
    return crypto
      .createHash('sha256')
      .update(fs.readFileSync(ruta))
      .digest('hex')
      .slice(0, 16);
  } catch {
    return '';
  }
}

/** Primera línea con contenido de la salida de un comando, para el aviso. */
function primeraLinea(texto) {
  const linea = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .find((l) => !/^(NOTICE|AVISO):/i.test(l));
  return linea ? linea.slice(0, 200) : 'sin detalle';
}

function tamanoLegible(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Recorre una carpeta y devuelve [{ruta relativa, bytes, sha256}]. */
function inventario(carpeta, base = carpeta) {
  const salida = [];
  if (!fs.existsSync(carpeta)) return salida;
  for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
    const completa = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) {
      salida.push(...inventario(completa, base));
    } else {
      const datos = fs.statSync(completa);
      salida.push({
        archivo: path.relative(base, completa).split(path.sep).join('/'),
        bytes: datos.size,
        sha256: huellaDe(completa),
      });
    }
  }
  return salida;
}

/**
 * Tablas que van al informe: agregados y hechos, sin nombres de personas.
 * Si algún día hace falta la tabla completa, se saca del respaldo, no de aquí.
 */
const TABLAS_INFORME = [
  {
    nombre: 'instituciones',
    sql: 'SELECT id, nombre, pais, estado, estado_cace FROM "INSTITUCION" ORDER BY id',
  },
  {
    nombre: 'proyectos',
    sql: 'SELECT id, estado, plataforma, creado_en FROM "PROYECTO_CLASE_ESPEJO" ORDER BY id',
  },
  {
    nombre: 'participantes-por-proyecto',
    sql:
      'SELECT proyecto_id, COUNT(*) AS participantes ' +
      'FROM "PROYECTO_PARTICIPANTE" GROUP BY proyecto_id ORDER BY proyecto_id',
  },
  {
    nombre: 'sesiones',
    sql: 'SELECT id, proyecto_id, fecha_hora, estado FROM "SESION" ORDER BY id',
  },
  {
    nombre: 'evidencias',
    sql: 'SELECT id, proyecto_id, sesion_id, tipo, creado_en FROM "EVIDENCIA" ORDER BY id',
  },
  {
    nombre: 'reportes-de-clase',
    sql: 'SELECT id, sesion_id, estado FROM "REPORTE_CLASE_CONJUNTA" ORDER BY id',
  },
  {
    nombre: 'certificados',
    sql: 'SELECT id, folio, proyecto_id, estado, emitido_en FROM "CERTIFICADO" ORDER BY id',
  },
  {
    nombre: 'listas-de-alumnos',
    sql:
      'SELECT lista_id, COUNT(*) AS alumnos FROM "ALUMNO" ' +
      'GROUP BY lista_id ORDER BY lista_id',
  },
];

/** Recuento de filas de todas las tablas: la cifra que se cita sin exponer datos. */
const SQL_CONTEO =
  'SELECT relname AS tabla, n_live_tup AS filas FROM pg_stat_user_tables ' +
  'ORDER BY relname';

/**
 * Ejecuta un programa hijo y devuelve su salida como texto.
 *
 * La salida se manda a un archivo en vez de capturarla por tubería: abrir una
 * tubería para leer stdout falla en entornos restringidos y en algunos
 * servidores con políticas estrictas, y entonces el paquete saldría incompleto
 * sin que se note. Con archivo, o funciona o queda el registro del fallo.
 */
function correr(comando, argumentos, opciones = {}) {
  const destino =
    opciones.salida ||
    path.join(os.tmpdir(), `exportar-piloto-${process.pid}-${Date.now()}.log`);
  const temporal = !opciones.salida;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const fd = fs.openSync(destino, 'w');
  let texto = '';
  let resultado;
  try {
    const r = spawnSync(comando, argumentos, {
      cwd: RAIZ,
      stdio: ['ignore', fd, fd],
    });
    if (r.error) {
      resultado = { status: -1, error: r.error, texto: '' };
    } else {
      try {
        texto = fs.readFileSync(destino, 'utf8');
      } catch {
        texto = '';
      }
      resultado = { status: r.status, texto, salida: destino };
    }
  } finally {
    fs.closeSync(fd);
    if (temporal) {
      try {
        fs.unlinkSync(destino);
      } catch {
        // si no se puede borrar, no importa: es un temporal fuera del paquete
      }
    }
  }
  return resultado;
}

function main() {
  const opciones = argumentos(process.argv.slice(2));
  const carpeta = path.resolve(
    opciones.salida ||
      path.join(RAIZ, 'exportaciones', `piloto-${marcaDeTiempo()}`),
  );
  fs.mkdirSync(carpeta, { recursive: true });

  console.log(`Paquete del piloto → ${carpeta}`);
  const pasos = [];
  const avisos = [];

  // ---------------------------------------------------------------- 1. respaldo
  if (opciones.sinArchivos) {
    avisos.push(
      'Respaldo omitido (--sin-archivos): no hay base.dump ni uploads/.',
    );
  } else {
    const destinoRespaldo = path.join(carpeta, 'respaldo');
    const args = ['scripts/respaldo.js', '--salida', destinoRespaldo];
    const log = path.join(carpeta, 'logs', 'respaldo.log');
    const r = correr(process.execPath, args, { salida: log });
    if (r.status === 0) {
      pasos.push('respaldo: base.dump, uploads/ y respaldo.json');
    } else {
      const detalle = r.error
        ? r.error.message
        : `código ${r.status}; ver ${path.relative(carpeta, log)}`;
      avisos.push(`El respaldo falló (${detalle}).`);
    }
  }

  // ---------------------------------------------------------------- 2. métricas
  const carpetaMetricas = path.join(carpeta, 'metricas');
  fs.mkdirSync(carpetaMetricas, { recursive: true });
  const jsonl = opciones.jsonl
    ? path.resolve(RAIZ, opciones.jsonl)
    : path.join(RAIZ, 'logs', 'rendimiento.jsonl');
  if (fs.existsSync(jsonl)) {
    const copiaJsonl = path.join(carpetaMetricas, 'rendimiento.jsonl');
    fs.copyFileSync(jsonl, copiaJsonl);
    // El guion escribe su resumen junto al archivo que lee, así que se le pasa
    // la copia y el resultado cae dentro del paquete.
    const r = correr(process.execPath, [
      'scripts/informe-rendimiento.js',
      copiaJsonl,
    ]);
    const generados = fs
      .readdirSync(carpetaMetricas)
      .filter((n) => /^rendimiento-informe-.*\.md$/i.test(n));
    if (r.status === 0 && generados.length > 0) {
      const origen = path.join(
        carpetaMetricas,
        generados[generados.length - 1],
      );
      fs.renameSync(origen, path.join(carpetaMetricas, 'rendimiento.md'));
      pasos.push('métricas: rendimiento.jsonl y su resumen en markdown');
    } else {
      const detalle = r.error ? r.error.message : `código ${r.status}`;
      avisos.push(
        `El JSONL se copió, pero el resumen no se pudo generar (${detalle}).`,
      );
    }
  } else {
    avisos.push(
      `No hay archivo de métricas en ${jsonl}. Para conservarlas entre reinicios hay ` +
        'que arrancar el servidor con METRICAS_ARCHIVO apuntando a un archivo. ' +
        'El endpoint /metricas/rendimiento.csv sirve solo para la instancia actual.',
    );
  }

  // ---------------------------------------------------------------- 3. tablas
  const carpetaTablas = path.join(carpeta, 'tablas');
  fs.mkdirSync(carpetaTablas, { recursive: true });
  if (opciones.sinTablas) {
    avisos.push('Tablas omitidas (--sin-tablas).');
  } else {
    const psql = buscarEjecutable('psql');
    const url = urlDeBase();
    const urlPsql = urlParaPsql(url);
    if (!psql || !url) {
      avisos.push(
        'No se encontró psql o DATABASE_URL: no se pudieron volcar las tablas. ' +
          'El respaldo sigue sirviendo para restaurar en otro servidor.',
      );
    } else {
      const respuestas = [];
      const carpetasLogs = path.join(carpeta, 'logs');
      // `-w` evita que psql se quede esperando una contraseña: falla y sigue.
      for (const tabla of TABLAS_INFORME) {
        const destino = path.join(carpetaTablas, `${tabla.nombre}.csv`);
        const comando = `\\copy (${tabla.sql}) TO '${destino.replace(/\\/g, '/')}' CSV HEADER`;
        const log = path.join(carpetasLogs, `tabla-${tabla.nombre}.log`);
        const r = correr(psql, [urlPsql, '-w', '-q', '-c', comando], {
          salida: log,
        });
        if (r.status === 0) respuestas.push(tabla.nombre);
        else
          avisos.push(
            `No se pudo volcar ${tabla.nombre}: ${primeraLinea(r.texto)}`,
          );
      }
      const conteo = path.join(carpetaTablas, 'recuento-tablas.csv');
      const comandoConteo = `\\copy (${SQL_CONTEO}) TO '${conteo.replace(/\\/g, '/')}' CSV HEADER`;
      const logConteo = path.join(carpetasLogs, 'tabla-recuento.log');
      const rConteo = correr(psql, [urlPsql, '-w', '-q', '-c', comandoConteo], {
        salida: logConteo,
      });
      if (rConteo.status === 0) {
        respuestas.push('recuento-tablas');
      } else {
        avisos.push(
          `No se pudo volcar el recuento: ${primeraLinea(rConteo.texto)}`,
        );
      }
      if (respuestas.length > 0) {
        pasos.push(`tablas: ${respuestas.join(', ')}`);
      }
    }
  }

  // ---------------------------------------------------------------- 4. versión
  const version = {};
  const git = correr('git', ['rev-parse', 'HEAD']);
  if (git.status === 0) version.commit = (git.texto || '').trim();
  const gitEstado = correr('git', ['status', '--porcelain']);
  version.arbolLimpio =
    gitEstado.status === 0 && (gitEstado.texto || '').trim() === '';
  version.node = process.version;
  version.plataforma = `${process.platform} ${process.arch}`;
  version.exportadoEn = new Date().toISOString();

  // ---------------------------------------------------------------- 5. manifiesto
  const archivos = inventario(carpeta);
  const manifiesto = {
    que: 'Paquete de cierre del piloto de Clases Conjuntas',
    version,
    totales: {
      archivos: archivos.length,
      bytes: archivos.reduce((a, b) => a + b.bytes, 0),
    },
    pasos,
    avisos,
    archivos,
  };
  fs.writeFileSync(
    path.join(carpeta, 'manifiesto.json'),
    `${JSON.stringify(manifiesto, null, 2)}\n`,
    'utf8',
  );

  const leeme = [
    '# Paquete de cierre del piloto',
    '',
    `Generado el ${version.exportadoEn} con Node ${version.node}.`,
    '',
    '## Qué hay aquí',
    '',
    '| Carpeta o archivo | Qué es | ¿Se adjunta al informe? |',
    '| --- | --- | --- |',
    '| `respaldo/base.dump` | Volcado completo de PostgreSQL | **No**: contiene datos personales |',
    '| `respaldo/uploads/` | Archivos subidos (evidencias, avatares, logos) | **No**, por lo mismo |',
    '| `respaldo/respaldo.json` | Datos para restaurar | No |',
    '| `metricas/rendimiento.jsonl` | Medición de cada petición | No hace falta: se adjunta el resumen |',
    '| `metricas/rendimiento.md` | Resumen de rendimiento | **Sí** |',
    '| `tablas/*.csv` | Agregados y hechos, sin nombres de personas | **Sí** |',
    '| `manifiesto.json` | Fecha, versión fijada, tamaños y huellas | Como anexo de trazabilidad |',
    '',
    '## Para qué sirve cada mitad',
    '',
    'El **respaldo** existe para no perder nada y poder restaurar en otro servidor. Va con datos',
    'personales y no se publica.',
    '',
    'Las **tablas y el resumen de métricas** existen para el informe: son recuentos y hechos. Se pueden',
    'adjuntar tal cual.',
    '',
    '## Antes de dejar de pagar el servidor',
    '',
    '1. Comprobar que este paquete se copió **fuera** del servidor (a tu equipo o a un disco).',
    '2. Probar la restauración con `npm run probar-restauracion` sobre una base de prueba.',
    '3. Anotar aquí la fecha de baja del servidor: ______________.',
    '',
    '## Avisos de esta exportación',
    '',
    ...(avisos.length > 0 ? avisos.map((a) => `* ${a}`) : ['* Ninguno.']),
    '',
    '## Pasos completados',
    '',
    ...(pasos.length > 0 ? pasos.map((p) => `* ${p}`) : ['* Ninguno.']),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(carpeta, 'LEEME.md'), leeme, 'utf8');

  // Segundo pase del manifiesto: el inventario se rehace para que incluya el
  // LEEME que acaba de escribirse. El propio manifiesto no se cuenta.
  manifiesto.archivos = inventario(carpeta).filter(
    (a) => a.archivo !== 'manifiesto.json',
  );
  manifiesto.totales = {
    archivos: manifiesto.archivos.length,
    bytes: manifiesto.archivos.reduce((a, b) => a + b.bytes, 0),
  };
  fs.writeFileSync(
    path.join(carpeta, 'manifiesto.json'),
    `${JSON.stringify(manifiesto, null, 2)}\n`,
    'utf8',
  );

  // ---------------------------------------------------------------- 6. comprimido
  if (opciones.zip) {
    const tar = buscarEjecutable('tar');
    if (tar) {
      const destino = `${carpeta}.tar.gz`;
      const r = correr(tar, [
        '-czf',
        destino,
        '-C',
        path.dirname(carpeta),
        path.basename(carpeta),
      ]);
      if (r.status === 0) console.log(`Comprimido: ${destino}`);
      else
        avisos.push('No se pudo comprimir; la carpeta queda igual de válida.');
    } else {
      avisos.push('No hay `tar` disponible: se deja la carpeta sin comprimir.');
    }
  }

  console.log('');
  console.log(`Archivos: ${manifiesto.totales.archivos}`);
  console.log(`Tamaño:   ${tamanoLegible(manifiesto.totales.bytes)}`);
  if (version.commit) {
    console.log(`Versión:  ${version.commit.slice(0, 12)}`);
  }
  if (avisos.length > 0) {
    console.log('');
    console.log('Avisos:');
    for (const aviso of avisos) console.log(`  · ${aviso}`);
  }
  console.log('');
  console.log(`Listo. Revisa LEEME.md en ${carpeta}`);
}

main();
