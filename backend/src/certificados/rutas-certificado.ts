import { join } from 'path';

/**
 * Carpetas de los certificados, dentro de `uploads`.
 *
 * Están aquí y no dentro de un servicio para que los tres que las necesitan
 * (el de emisión, el que genera el PDF y el de la plantilla) las lean del mismo
 * sitio sin importarse entre ellos: la carpeta de los PDF emitidos es
 * **privada** (son documentos personales y se sirven siempre con sesión, nunca
 * como estáticos) y la de los fondos es la que sí se pinta con `<img>` en el
 * panel del presidente.
 */
export const CERTIFICADOS_DIR = join(process.cwd(), 'uploads', 'certificados');

/** Fondos de la plantilla (imágenes que se ven en línea desde el panel). */
export const FONDOS_CERTIFICADO_DIR = join(
  process.cwd(),
  'uploads',
  'certificados-fondos',
);
