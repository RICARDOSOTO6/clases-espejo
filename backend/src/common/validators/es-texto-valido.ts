import { registerDecorator, ValidationOptions } from 'class-validator';

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/**
 * Reglas para un texto "humano" (nombres, apellidos, lugares, especialidad):
 *  - solo letras (con acentos) separadas por espacio, apóstrofe, guion o punto
 *  - al menos una vocal
 *  - sin 3+ letras iguales seguidas (ej. "aaaa")
 *  - sin secuencias de teclado (ej. "qwerty", "asdf")
 *  - longitud entre 2 y 80 caracteres
 */
export function esTextoValido(value: unknown): boolean {
  if (value == null || value === '') return true; // @IsNotEmpty se encarga del vacío
  if (typeof value !== 'string') return false;

  const t = value.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ .'-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/.test(t)) {
    return false;
  }
  if (!/[aeiouáéíóúü]/i.test(t)) return false;
  if (/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])\1\1/i.test(t)) return false;
  if (tieneSecuenciaTeclado(t)) return false;
  return true;
}

function tieneSecuenciaTeclado(t: string): boolean {
  const s = t.toLowerCase();
  for (let i = 0; i <= s.length - 4; i++) {
    const sub = s.slice(i, i + 4);
    if (KEYBOARD_ROWS.some((row) => row.includes(sub))) return true;
  }
  return false;
}

export function EsTextoValido(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'esTextoValido',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return esTextoValido(value);
        },
        defaultMessage() {
          return 'El texto no parece un valor válido (usa letras, sin secuencias aleatorias)';
        },
      },
    });
  };
}
