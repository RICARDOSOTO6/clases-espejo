import { FormGroup } from '@angular/forms';

/**
 * Mensaje de error de un campo de un formulario reactivo.
 *
 * Se enseña solo cuando el campo ya se tocó, y `textos` va del error más
 * general al más específico: el orden importa, porque un campo vacío con
 * `required` y `minlength` a la vez debe enseñar el de `required`.
 *
 * El esqueleto (`control.touched` + `control.errors`) estaba copiado en cinco
 * métodos del panel de la CACE y en los tres del acceso (`login`, `register` y
 * `activate`); aquí vive una sola vez.
 */
export function mensajeDeControl(
  form: FormGroup,
  campo: string,
  textos: Record<string, string>,
): string | null {
  const control = form.get(campo);
  if (!control || !control.touched || !control.errors) return null;
  for (const [error, texto] of Object.entries(textos)) {
    if (control.errors[error]) return texto;
  }
  return null;
}
