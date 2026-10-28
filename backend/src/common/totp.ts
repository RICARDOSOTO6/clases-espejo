import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Utilidades TOTP sin dependencias externas.
 *
 * Se implementa RFC 6238 con HMAC-SHA1, 6 dígitos y pasos de 30 segundos.
 * No se usa una librería para no añadir otra dependencia de autenticación al
 * paquete que ya está congelado.
 */

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PASO_SEGUNDOS = 30;
const DIGITOS = 6;
const VENTANA = 1;

export const EMISOR_TOTP = 'Clases Conjuntas';
export const NOMBRE_TOTP = 'Clases Conjuntas';

export function generarSecretoTotp(): string {
  return codificarBase32(randomBytes(20));
}

export function codigoTotp(
  secreto: string,
  fechaMs: number = Date.now(),
  paso: number = PASO_SEGUNDOS,
): string {
  const contador = Math.floor(fechaMs / 1000 / paso);
  const llave = decodificarBase32(secreto);
  const bufferContador = Buffer.alloc(8);
  bufferContador.writeBigUInt64BE(BigInt(contador));

  const hmac = createHmac('sha1', llave).update(bufferContador).digest();
  const desplazamiento = hmac[hmac.length - 1] & 0x0f;
  const binario =
    ((hmac[desplazamiento] & 0x7f) << 24) |
    ((hmac[desplazamiento + 1] & 0xff) << 16) |
    ((hmac[desplazamiento + 2] & 0xff) << 8) |
    (hmac[desplazamiento + 3] & 0xff);

  return (binario % 10 ** DIGITOS).toString().padStart(DIGITOS, '0');
}

export function verificarCodigoTotp(
  secreto: string,
  codigo: string,
  ultimoPaso: number = 0,
  fechaMs: number = Date.now(),
): { valido: boolean; paso: number } {
  const limpio = normalizarCodigo(codigo);
  if (!/^\d{6}$/.test(limpio)) return { valido: false, paso: ultimoPaso };

  const pasoActual = Math.floor(fechaMs / 1000 / PASO_SEGUNDOS);
  for (
    let desplazamiento = -VENTANA;
    desplazamiento <= VENTANA;
    desplazamiento++
  ) {
    const paso = pasoActual + desplazamiento;
    if (paso <= ultimoPaso) continue;
    if (codigoTotp(secreto, paso * PASO_SEGUNDOS * 1000) !== limpio) continue;
    return { valido: true, paso };
  }

  return { valido: false, paso: ultimoPaso };
}

export function uriTotp(correo: string, secreto: string): string {
  const etiqueta = encodeURIComponent(`${EMISOR_TOTP}:${correo}`);
  const emisor = encodeURIComponent(EMISOR_TOTP);
  return (
    `otpauth://totp/${etiqueta}?secret=${secreto}` +
    `&issuer=${emisor}&algorithm=SHA1&digits=${DIGITOS}&period=${PASO_SEGUNDOS}`
  );
}

export function generarCodigosRecuperacion(cantidad = 8): string[] {
  const codigos = new Set<string>();
  while (codigos.size < cantidad) {
    const codigo = codificarBase32(randomBytes(5)).slice(0, 8);
    codigos.add(`${codigo.slice(0, 4)}-${codigo.slice(4, 8)}`);
  }
  return [...codigos];
}

export function hashCodigoRecuperacion(codigo: string): string {
  return createHash('sha256')
    .update(`${normalizarRecuperacion(codigo)}|${process.env.JWT_SECRET ?? ''}`)
    .digest('hex');
}

export function normalizarRecuperacion(codigo: string): string {
  return codigo.replace(/[\s-]/g, '').toUpperCase();
}

function normalizarCodigo(codigo: string): string {
  return (codigo ?? '').replace(/\s/g, '');
}

function codificarBase32(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';

  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    salida += ALFABETO_BASE32[(valor << (5 - bits)) & 31];
  }

  return salida;
}

function decodificarBase32(cadena: string): Buffer {
  const limpio = cadena.replace(/=+$/g, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let valor = 0;
  const salida: number[] = [];

  for (const caracter of limpio) {
    const indice = ALFABETO_BASE32.indexOf(caracter);
    if (indice < 0) throw new Error('Secreto TOTP inválido');

    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      salida.push((valor >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(salida);
}
