import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

interface Registro {
  intentos: number;
  expira: number;
}

/**
 * Límite de intentos en memoria para el login y la activación de cuenta.
 * No sustituye a un limitador distribuido, pero frena la fuerza bruta básica
 * sin añadir dependencias.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly registros = new Map<string, Registro>();
  private static readonly maxRegistros = 5000;
  private readonly maxIntentos = 10;
  private readonly ventanaMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'desconocida';
    const correo = String(request.body?.correo ?? '');
    const clave = `${ip}|${correo}`;
    const ahora = Date.now();

    this.limpiarSiHaceFalta(ahora);

    const registro = RateLimitGuard.registros.get(clave);
    if (!registro || registro.expira < ahora) {
      RateLimitGuard.registros.set(clave, {
        intentos: 1,
        expira: ahora + this.ventanaMs,
      });
      return true;
    }

    registro.intentos += 1;
    if (registro.intentos > this.maxIntentos) {
      throw new HttpException(
        'Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /** Evita que el mapa crezca sin control. */
  private limpiarSiHaceFalta(ahora: number): void {
    if (RateLimitGuard.registros.size < RateLimitGuard.maxRegistros) return;
    for (const [clave, registro] of RateLimitGuard.registros) {
      if (registro.expira < ahora) RateLimitGuard.registros.delete(clave);
    }
  }
}
