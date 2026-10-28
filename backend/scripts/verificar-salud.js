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
 * Sale con 1 y avisa por el webhook configurado si no responde o responde mal.
 *
 * Variables opcionales:
 *   ALERTA_WEBHOOK_URL   Slack, Discord, Telegram o endpoint propio.
 *   ALERTA_WEBHOOK_TOKEN token Bearer opcional.
 *   ALERTA_COOLDOWN_MIN  minutos entre alertas repetidas (por defecto 30).
 *   ALERTA_STATE_FILE    archivo de estado para el cooldown.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const url =
  process.argv[2] ||
  `${process.env.APP_URL ?? 'http://localhost:3000'}/health`;
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? 10000);
const webhookUrl = (process.env.ALERTA_WEBHOOK_URL ?? '').trim();
const webhookToken = (process.env.ALERTA_WEBHOOK_TOKEN ?? '').trim();
const cooldownMs =
  Math.max(1, Number(process.env.ALERTA_COOLDOWN_MIN ?? 30)) * 60_000;
const archivoEstado =
  process.env.ALERTA_STATE_FILE ??
  path.join(os.tmpdir(), 'clasesconjuntas-salud-alerta.json');

function leerEstado() {
  try {
    return JSON.parse(fs.readFileSync(archivoEstado, 'utf8'));
  } catch {
    return {};
  }
}

function guardarEstado(datos) {
  try {
    fs.writeFileSync(archivoEstado, JSON.stringify(datos), 'utf8');
  } catch (error) {
    console.error(
      `No se pudo guardar el estado de alertas: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function enviarWebhook(texto) {
  if (!webhookUrl) {
    console.error(
      'Salud falló, pero no hay ALERTA_WEBHOOK_URL configurada para avisar.',
    );
    return false;
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const respuesta = await fetch(webhookUrl, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'content-type': 'application/json',
        ...(webhookToken
          ? { authorization: `Bearer ${webhookToken}` }
          : {}),
      },
      // Se mandan `text` y `content`: Slack usa el primero y Discord el segundo.
      body: JSON.stringify({
        text: texto,
        content: texto,
        source: 'clases-conjuntas/health',
        timestamp: new Date().toISOString(),
        url,
      }),
    });
    if (!respuesta.ok) {
      throw new Error(`webhook respondió ${respuesta.status}`);
    }
    return true;
  } finally {
    clearTimeout(temporizador);
  }
}

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

    const estado = leerEstado();
    if (estado.ultimaAlerta) {
      await enviarWebhook(
        `Clases Conjuntas volvió a responder correctamente en ${url}.`,
      );
      guardarEstado({});
    }
    console.log(`ok ${url}`);
  } finally {
    clearTimeout(temporizador);
  }
}

main().catch(async (error) => {
  const motivo = error instanceof Error ? error.message : String(error);
  console.error(`health falló en ${url}: ${motivo}`);

  const estado = leerEstado();
  const ahora = Date.now();
  const puedeAvisar =
    !estado.ultimaAlerta || ahora - Number(estado.ultimaAlerta) >= cooldownMs;
  if (puedeAvisar) {
    try {
      const enviada = await enviarWebhook(
        `Clases Conjuntas no responde en ${url}. Motivo: ${motivo}`,
      );
      if (enviada) guardarEstado({ ultimaAlerta: ahora });
    } catch (errorWebhook) {
      console.error(
        `No se pudo enviar la alerta: ${
          errorWebhook instanceof Error
            ? errorWebhook.message
            : String(errorWebhook)
        }`,
      );
    }
  } else {
    console.error(
      `Alerta en cooldown; no se repite durante ${Math.round(cooldownMs / 60000)} minuto(s).`,
    );
  }

  process.exit(1);
});
