import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Código corto de verificación de un certificado.
 *
 * El folio (`CACE-2026-0001`) es **secuencial y adivinable**: probando números
 * se llega al de cualquiera. Por eso la página pública no se conforma con él:
 * pide además un código que solo se puede calcular con el secreto del servidor,
 * y ese código va dentro del QR impreso. Quien tiene el certificado en la mano
 * puede verificar; quien va probando folios, no.
 *
 * Tres decisiones que conviene no deshacer:
 *
 * 1. **Se deriva, no se guarda.** El código sale de un HMAC del folio con el
 *    secreto que ya usa el proyecto para firmar (`JWT_SECRET`). Así no hace
 *    falta ninguna columna nueva ni migrar nada, y los certificados ya emitidos
 *    tienen código sin reemitirlos.
 * 2. **Se lee en voz alta.** Ocho caracteres de un alfabeto sin letras ni
 *    números que se confunden al dictarlos (`I`, `O`, `0`, `1`) y siempre en
 *    mayúsculas, porque el alfabeto es de 32 símbolos (potencia de dos): cada
 *    byte del resumen elige uno sin sesgo.
 * 3. **Se compara sin filtrar el tiempo.** La comprobación usa una comparación
 *    de tiempo constante; el sentido común dice que adivinar ocho caracteres por
 *    fuerza bruta no depende de eso, pero cuesta lo mismo hacerlo bien.
 */

/**
 * Alfabeto del código: 32 símbolos, sin los que se confunden al dictarlos por
 * teléfono. Es del tamaño de un byte módulo 32, así que reparte por igual.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Longitud del código. Con 32 símbolos son 2^40 combinaciones. */
const LONGITUD = 8;

/**
 * Con esto se separa el código de cualquier otro uso del mismo secreto: el
 * HMAC del certificado no es un token de sesión ni se puede confundir con uno.
 */
const CONTEXTO = 'certificado-verificacion';

/**
 * Los folios que emite la aplicación: `CACE-<año>-<consecutivo>`. Se comprueba
 * antes de tocar la base para no consultar por cualquier cosa que llegue por la
 * URL, y para que un folio inventado ni siquiera provoque una consulta.
 */
const FORMATO_FOLIO = /^CACE-\d{4}-\d{4,}$/;

/** El folio tal como se compara y se imprime: sin espacios y en mayúsculas. */
export function normalizarFolio(folio: string | null | undefined): string {
  return (folio ?? '').trim().toUpperCase();
}

/** El código tal como lo teclea una persona: sin guiones ni espacios. */
export function normalizarCodigo(codigo: string | null | undefined): string {
  return (codigo ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** ¿Tiene el folio la forma que emite la aplicación? */
export function formatoFolioValido(folio: string | null | undefined): boolean {
  return FORMATO_FOLIO.test(normalizarFolio(folio));
}

/**
 * El código de un folio. Es determinista: el mismo folio da siempre el mismo
 * código, que es lo que permite que un certificado emitido hace meses siga
 * verificándose sin guardar nada más.
 */
export function codigoVerificacion(folio: string): string {
  const resumen = createHmac('sha256', secreto())
    .update(`${CONTEXTO}:${normalizarFolio(folio)}`)
    .digest();

  let codigo = '';
  for (let indice = 0; indice < LONGITUD; indice += 1) {
    codigo += ALFABETO[resumen[indice] % ALFABETO.length];
  }
  return codigo;
}

/**
 * ¿El código que llegó es el del folio? Sin código, o con uno que no encaje, la
 * respuesta es `false` y quien pregunta no aprende nada del certificado.
 */
export function codigoValido(
  folio: string,
  codigo: string | null | undefined,
): boolean {
  const recibido = normalizarCodigo(codigo);
  if (recibido.length !== LONGITUD) return false;
  return timingSafeEqual(Buffer.from(recibido), Buffer.from(codigoVerificacion(folio)));
}

/**
 * El secreto con el que se firma el código.
 *
 * Se lee en cada llamada y no al cargar el módulo porque las pruebas y los
 * scripts cambian el entorno; y si faltara **se avisa en vez de seguir**: un
 * código calculado con un secreto vacío lo adivinaría cualquiera.
 */
function secreto(): string {
  const valor = (process.env.JWT_SECRET ?? '').trim();
  if (valor.length < 16) {
    throw new Error(
      'Falta JWT_SECRET (o es demasiado corto): sin ese secreto no se puede calcular el código de verificación de los certificados.',
    );
  }
  return valor;
}
