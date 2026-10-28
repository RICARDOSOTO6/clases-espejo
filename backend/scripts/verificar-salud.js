#!/usr/bin/env node
'use strict';

/**
 * Comprobación externa de salud para cron/systemd.
 *
 * Uso:
 *   node scripts/verificar-salud.js
 *   node scripts/verificar-salud.js https://clases.tudominio.org/health
 *
 * Sale con código 0 si /health responde 200 y `{ status: "ok" }`.
 * Sale con 1 y un mensaje a stderr si no responde o responde mal.
 */

const url =
  process.argv[2] ||
  `${process.env.APP_URL ?? 'http://localhost:3000'}/health`;
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? 10000);

async function main() {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const respuesta = await fetch(url, {
      signal: controlador.signal,
      headers: { accept: 'application/json' },
    });
    const cuerpo = await respuesta.text();
    let json;
    try {
      json = JSON.parse(cuerpo);
    } catch {
      throw new Error(`respuesta no JSON: ${cuerpo.slice(0, 120)}`);
    }
    if (!respuesta.ok || json.status !== 'ok') {
      throw new Error(`estado ${respuesta.status}: ${cuerpo.slice(0, 160)}`);
    }
    console.log(`ok ${url}`);
  } finally {
    clearTimeout(temporizador);
  }
}

main().catch((error) => {
  console.error(
    `health falló en ${url}: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
