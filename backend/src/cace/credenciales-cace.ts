import { randomInt } from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Credenciales provisionales de los miembros de la CACE.
 *
 * Lo comparten el alta automática de la presidencia al arrancar (`CaceService`)
 * y el alta de secretarías que hace el presidente desde su panel
 * (`MiembrosCaceService`): las dos crean la cuenta igual, con contraseña
 * provisional y cambio obligatorio en el primer acceso, y no tiene sentido
 * mantener dos copias del mismo alfabeto y del mismo generador de DNI.
 */

/**
 * Alfabeto de la contraseña provisional. Se dejan fuera los pares que se
 * confunden al copiarlos de un correo (0/O, 1/l/I): la contraseña se transcribe
 * a mano una sola vez, y un carácter ambiguo es un acceso fallido.
 */
const ALFABETO_PROVISIONAL =
  'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_PASSWORD = 12;

/**
 * Contraseña provisional de 12 caracteres. `randomInt` es criptográfico: una
 * contraseña adivinable sería una puerta abierta a la CACE.
 */
export function generarPasswordProvisional(): string {
  let password = '';
  for (let i = 0; i < LARGO_PASSWORD; i++) {
    password += ALFABETO_PROVISIONAL[randomInt(ALFABETO_PROVISIONAL.length)];
  }
  return password;
}

/**
 * DNI provisional único: la columna es única y no admite vacíos, y un miembro de
 * la CACE todavía no tiene un documento real que guardar. Se comprueba contra la
 * base para que un choque no rompa el alta.
 */
export async function generarDniUnico(prisma: PrismaService): Promise<string> {
  for (let intento = 0; intento < 5; intento++) {
    const dni = `CACE-${randomInt(100000, 999999)}`;
    const ocupado = await prisma.usuario.findUnique({
      where: { dni },
      select: { id: true },
    });
    if (!ocupado) return dni;
  }
  // Con 900 000 combinaciones, cinco choques seguidos ya no es mala suerte.
  return `CACE-${Date.now()}`;
}
