/**
 * Entorno de las pruebas e2e. Jest lo ejecuta **antes** de cargar cada suite,
 * así que aquí se decide contra qué base van las pruebas y se completan los
 * secretos que falten.
 *
 * - `TEST_DATABASE_URL` (si existe) manda sobre `DATABASE_URL`. Es la forma de
 *   correr las e2e contra `clasesconjuntasbd_test` sin tocar el `.env` normal.
 * - Si no hay `JWT_SECRET` (por ejemplo en un runner sin `.env`), se usa uno de
 *   pruebas. La aplicación se niega a arrancar sin él, y aquí no hay secreto
 *   real que proteger.
 */
import 'dotenv/config';

// Las suites no deben arrancar el worker periódico de correo: la cola se procesa
// a mano para que el resultado sea determinista (el worker lo comprueba).
process.env.NODE_ENV = 'test';

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}
