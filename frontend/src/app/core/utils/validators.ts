import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/**
 * Validador de texto "humano": rechaza dígitos/símbolos en nombres,
 * secuencias de teclado, repeticiones y textos sin vocales.
 */
export function esTextoValido(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value == null || value === '') return null; // 'required' maneja el vacío

    const t = String(value).trim();
    const ok =
      t.length >= 2 &&
      t.length <= 80 &&
      /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ .'-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/.test(t) &&
      /[aeiouáéíóúü]/i.test(t) &&
      !/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])\1\1/i.test(t) &&
      !tieneSecuenciaTeclado(t);

    return ok ? null : { textoInvalido: true };
  };
}

function tieneSecuenciaTeclado(t: string): boolean {
  const s = t.toLowerCase();
  for (let i = 0; i <= s.length - 4; i++) {
    const sub = s.slice(i, i + 4);
    if (KEYBOARD_ROWS.some((row) => row.includes(sub))) return true;
  }
  return false;
}
