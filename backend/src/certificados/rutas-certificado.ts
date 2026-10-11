import { join } from 'path';

/**
 * Carpetas de los certificados, dentro de `uploads`, y la dirección pública de
 * verificación que llevan impresa.
 *
 * Las carpetas están aquí y no dentro de un servicio para que los tres que las
 * necesitan (el de emisión, el que genera el PDF y el de la plantilla) las lean
 * del mismo sitio sin importarse entre ellos: la carpeta de los PDF emitidos es
 * **privada** (son documentos personales y se sirven siempre con sesión, nunca
 * como estáticos) y la de los diseños es la que sí se pinta con `<img>` en el
 * panel de la presidencia.
 */
export const CERTIFICADOS_DIR = join(process.cwd(), 'uploads', 'certificados');

/** Diseños de la plantilla (imágenes que se ven en línea desde el panel). */
export const FONDOS_CERTIFICADO_DIR = join(
  process.cwd(),
  'uploads',
  'certificados-fondos',
);

/**
 * La dirección pública de la aplicación, que es la base del enlace del QR:
 * `{URL_PUBLICA}/verificar/{folio}`.
 *
 * Sale de la variable de entorno `URL_PUBLICA`, para que en producción el QR
 * apunte al dominio de verdad y no a `localhost`. Si no está definida se usa
 * `http://localhost:3000`, que es el valor razonable en desarrollo: **nunca**
 * se cae la emisión por no tenerla puesta.
 */
export function urlPublica(): string {
  const valor = (process.env.URL_PUBLICA ?? '').trim();
  return (valor || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * La dirección que abre el QR de un certificado. La página de verificación es
 * de la fase siguiente: aquí solo se **apunta** a ella.
 */
export function direccionVerificacion(folio: string): string {
  return `${urlPublica()}/verificar/${encodeURIComponent(folio)}`;
}
