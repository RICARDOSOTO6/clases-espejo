/**
 * Contraseñas comunes que no se aceptan al establecer una nueva.
 *
 * No se consulta Internet ni se envía la contraseña a ningún servicio: es una
 * lista local, corta y pensada para frenar las elecciones más obvias. La
 * comprobación contra filtraciones reales (por ejemplo, Have I Been Pwned con
 * k-anonymity) se puede añadir más adelante sin cambiar la política.
 */
const COMUNES = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  '123456789012345',
  'qwertyuiopas',
  'qwertyuiop123',
  'password1234',
  'password12345',
  'contrasena123',
  'contrasena1234',
  'administrador',
  'administrador123',
  'bienvenido123',
  'bienvenida123',
  'clasesespejo',
  'clasesconjuntas',
  'clasesconjuntas123',
  'cace2026',
  'cace20262026',
  'demo1234',
  'demo12345',
  'demo123456',
  'iloveyou1234',
  'soyadmin1234',
  'cambiar12345',
  'temporal1234',
  'universidad123',
  'docente12345',
  'alumno123456',
]);

/**
 * Prefijos que delatan una contraseña común incluso si lleva números o años.
 * Se compara contra la versión normalizada (sin acentos y en minúsculas).
 */
const PREFIJOS = [
  'password',
  'contrasena',
  'qwerty',
  '123456',
  'administrador',
  'bienvenid',
  'clasesespejo',
  'clasesconjuntas',
  'cace',
  'demo',
  'temporal',
  'cambiar',
];

function normalizar(password: string): string {
  return (password ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function esPasswordComun(password: string): boolean {
  const clave = normalizar(password);
  if (!clave) return false;
  if (COMUNES.has(clave)) return true;
  return PREFIJOS.some((prefijo) => clave.startsWith(prefijo));
}
