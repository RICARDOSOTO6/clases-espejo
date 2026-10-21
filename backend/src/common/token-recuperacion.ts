import { createHash, randomBytes } from 'crypto';

/**
 * Token del enlace de recuperación de contraseña.
 *
 * Se genera con 32 bytes aleatorios (`base64url`, 43 caracteres) y **solo se
 * guarda su hash SHA-256** en la base: una copia de la base de datos no sirve
 * para restablecer contraseñas ajenas. El token en claro solo viaja en el
 * enlace del correo.
 */
export const VIGENCIA_RECUPERACION_MS = 60 * 60 * 1000; // 1 hora

/** El correo de confirmación de la cuenta dura más: se revisa con calma. */
export const VIGENCIA_VERIFICACION_MS = 48 * 60 * 60 * 1000; // 48 horas

/** Token nuevo, imposible de adivinar, apto para ir en una URL. */
export function generarTokenRecuperacion(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash con el que se busca el token en la base. */
export function hashTokenRecuperacion(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
