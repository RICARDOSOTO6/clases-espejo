/**
 * Temas visuales de la CACE (fase 3).
 *
 * El usuario pidió **temas predefinidos y no color libre**: un color elegido a
 * mano rompe el contraste y la accesibilidad, que es justo el fallo que se
 * arregló con el botón invisible. La lista es corta y cerrada, y cada tema está
 * definido en `frontend/src/styles.css` con sus colores ya comprobados.
 *
 * El valor guardado en `CONFIGURACION_CACE.tema` es una de estas claves; el
 * frontend la pinta como atributo `data-tema` en el elemento raíz.
 */
export const TEMAS_CACE = ['AZUL', 'VERDE', 'VINO', 'OSCURO'] as const;

export type TemaCace = (typeof TEMAS_CACE)[number];

/** Tema por defecto: el azul actual, para que nada cambie si no se elige otro. */
export const TEMA_CACE_POR_DEFECTO: TemaCace = 'AZUL';

export function esTemaCaceValido(tema: string | null | undefined): tema is TemaCace {
  return !!tema && (TEMAS_CACE as readonly string[]).includes(tema);
}
