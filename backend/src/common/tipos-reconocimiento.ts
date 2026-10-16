/** Tipos cerrados para distinguir premios de buenas prácticas y menciones. */
export const TIPOS_RECONOCIMIENTO = [
  'PREMIO',
  'RECONOCIMIENTO',
  'BUENA_PRACTICA',
  'MENCION',
  'SELECCION',
] as const;

export type TipoReconocimiento = (typeof TIPOS_RECONOCIMIENTO)[number];
