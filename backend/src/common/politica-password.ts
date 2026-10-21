import { BadRequestException } from '@nestjs/common';

/**
 * Política de contraseñas de la Fase 1.
 *
 * Decisión cerrada en el plan: **mínimo 10 caracteres y distinta del correo**.
 * No se imponen reglas de «una mayúscula, un número y un símbolo» porque
 * empujan a contraseñas predecibles; la longitud es lo que más protege.
 *
 * Las cuentas que ya existían conservan su contraseña: la política se aplica
 * cuando se **establece** una nueva (registro, activación, cambio o
 * restablecimiento), no al iniciar sesión.
 */
export const PASSWORD_MINIMO = 10;

/** Intentos fallidos seguidos antes de bloquear temporalmente la cuenta. */
export const INTENTOS_MAXIMOS = 5;

/** Minutos que dura el bloqueo por intentos fallidos. */
export const BLOQUEO_MINUTOS = 15;

/**
 * Devuelve el problema encontrado, o `null` si la contraseña cumple.
 * Se usa en el servicio (que conoce el correo) y en las pruebas.
 */
export function problemaDePassword(
  password: string,
  correo: string,
): string | null {
  const clave = password ?? '';
  if (clave.length < PASSWORD_MINIMO) {
    return `La contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres.`;
  }
  if (
    clave.trim().toLowerCase() === (correo ?? '').trim().toLowerCase() &&
    clave.trim() !== ''
  ) {
    return 'La contraseña no puede ser igual a tu correo.';
  }
  if (new Set(clave).size === 1) {
    return 'La contraseña no puede ser el mismo carácter repetido.';
  }
  return null;
}

/** Lanza un 400 legible si la contraseña no cumple la política. */
export function exigirPoliticaPassword(password: string, correo: string): void {
  const problema = problemaDePassword(password, correo);
  if (problema) throw new BadRequestException(problema);
}
