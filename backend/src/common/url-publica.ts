import type { Request } from 'express';

/**
 * URL pública del frontend, la que va dentro de los enlaces que se envían por
 * correo (invitación de docentes).
 *
 * El orden de prioridad es:
 *
 * 1. `FRONTEND_URL`, si apunta a algo que no sea localhost. Es lo correcto
 *    cuando el sistema ya vive en un dominio fijo.
 * 2. El origen real de la petición, tomado de las cabeceras del proxy
 *    (`X-Forwarded-Proto` / `X-Forwarded-Host`), del `Origin` o del `Host` —
 *    siempre que **no** sea localhost. Esto es lo que hace que funcione un túnel
 *    (`cloudflared`, `ngrok`), un proxy inverso o una demo por IP de la red
 *    local sin tocar la configuración.
 * 3. El primer valor de `FRONTEND_URL` (aunque sea localhost), como último
 *    recurso para desarrollo.
 *
 * Seguridad: la opción 2 confía en cabeceras que puede enviar el cliente, así
 * que se puede acotar con `URLS_PERMITIDAS` (lista separada por comas, admite
 * `*.dominio`). Sin esa variable se acepta cualquier host válido, que es lo
 * cómodo con túneles; en producción con dominio fijo manda la opción 1 y este
 * camino ni se usa.
 */

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i;
/** Host sintácticamente válido: nombre o IP, con puerto opcional. */
const HOST_VALIDO = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i;

/** Valores de `FRONTEND_URL` (admite varios separados por coma). */
export function origenesConfigurados(): string[] {
  return (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
}

/** Hosts permitidos para derivar del origen de la petición (vacío = cualquiera). */
export function hostsPermitidos(): string[] {
  return (process.env.URLS_PERMITIDAS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function esLocalhost(url: string): boolean {
  return LOCALHOST.test(url);
}

/** URL pública que debe usarse en los enlaces enviados por correo. */
export function resolverUrlPublica(peticion?: Request): string {
  const configurados = origenesConfigurados();
  const publico = configurados.find((origen) => !esLocalhost(origen));
  if (publico) return sinBarraFinal(publico);

  const deLaPeticion = origenDeLaPeticion(peticion);
  if (deLaPeticion) return deLaPeticion;

  return sinBarraFinal(configurados[0] ?? 'http://localhost:4200');
}

/**
 * Origen (`protocolo://host`) tal como lo ve el cliente o el proxy. Se descarta
 * si es localhost (en desarrollo el frontend tiene su propio puerto y manda
 * `FRONTEND_URL`) o si el host no está en `URLS_PERMITIDAS`.
 */
function origenDeLaPeticion(peticion?: Request): string | null {
  if (!peticion) return null;

  const protocoloProxy = primeraCabecera(peticion, 'x-forwarded-proto');
  const candidatos: string[] = [
    primeraCabecera(peticion, 'x-forwarded-host'),
    cabecera(peticion, 'origin'),
    cabecera(peticion, 'referer'),
    cabecera(peticion, 'host'),
  ].filter((valor): valor is string => Boolean(valor));

  for (const candidato of candidatos) {
    const partes = parsearOrigen(candidato);
    if (!partes || !hostPermitido(partes.host)) continue;

    // El protocolo del proxy manda; si no, se respeta el de la propia URL
    // (importante cuando llega `Origin: https://…` sin cabeceras de proxy).
    const protocolo = esquema(
      protocoloProxy ?? partes.protocolo ?? peticion.protocol,
    );
    const origen = `${protocolo}://${partes.host}`;
    if (!esLocalhost(origen)) return origen;
  }
  return null;
}

/** Separa protocolo y host de una URL completa o de una cadena `host[:puerto]`. */
function parsearOrigen(
  valor: string,
): { protocolo?: string; host: string } | null {
  const limpio = valor.trim();
  if (HOST_VALIDO.test(limpio)) return { host: limpio.toLowerCase() };

  try {
    const url = new URL(limpio);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.host.toLowerCase();
    return HOST_VALIDO.test(host)
      ? { protocolo: url.protocol.replace(':', ''), host }
      : null;
  } catch {
    return null;
  }
}

/** Solo http y https; cualquier otra cosa se trata como http. */
function esquema(valor?: string): 'http' | 'https' {
  return valor?.toLowerCase() === 'https' ? 'https' : 'http';
}

/** ¿El host entra en `URLS_PERMITIDAS`? Sin lista, se acepta cualquiera. */
function hostPermitido(host: string): boolean {
  const permitidos = hostsPermitidos();
  if (permitidos.length === 0) return true;

  const nombre = host.split(':')[0];
  return permitidos.some((patron) => {
    const esperado = patron.split(':')[0];
    if (esperado.startsWith('*.')) {
      const sufijo = esperado.slice(1); // ".trycloudflare.com"
      return nombre === esperado.slice(2) || nombre.endsWith(sufijo);
    }
    return nombre === esperado;
  });
}

function cabecera(peticion: Request, nombre: string): string | undefined {
  const valor = peticion.headers?.[nombre];
  if (Array.isArray(valor)) return valor[0];
  return typeof valor === 'string' ? valor : undefined;
}

function primeraCabecera(
  peticion: Request,
  nombre: string,
): string | undefined {
  // `x-forwarded-proto` puede venir como lista: "https,http".
  return cabecera(peticion, nombre)?.split(',')[0]?.trim();
}

function sinBarraFinal(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
