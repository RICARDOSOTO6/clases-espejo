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
 * Límite de la verificación pública por IP.
 *
 * Es más permisivo que el del login: un aula entera puede escanear el QR de sus
 * certificados desde la misma red y no debe quedarse fuera. 60 consultas por
 * minuto por IP frenan la enumeración sin romper una clase normal.
 */
@Injectable()
export class RateLimitVerificacionGuard implements CanActivate {
  private static readonly registros = new Map<string, Registro>();
  private static readonly maxRegistros = 5000;
  private readonly maxIntentos = 60;
  private readonly ventanaMs = 60_000;

  /** Solo para las pruebas: deja el contador limpio. */
  static reiniciar(): void {
    RateLimitVerificacionGuard.registros.clear();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'desconocida';
    const ahora = Date.now();

    this.limpiarSiHaceFalta(ahora);

    const registro = RateLimitVerificacionGuard.registros.get(ip);
    if (!registro || registro.expira < ahora) {
      RateLimitVerificacionGuard.registros.set(ip, {
        intentos: 1,
        expira: ahora + this.ventanaMs,
      });
      return true;
    }

    registro.intentos += 1;
    if (registro.intentos > this.maxIntentos) {
      throw new HttpException(
        'Demasiadas consultas seguidas. Espera un minuto e inténtalo de nuevo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private limpiarSiHaceFalta(ahora: number): void {
    if (
      RateLimitVerificacionGuard.registros.size <
      RateLimitVerificacionGuard.maxRegistros
    ) {
      return;
    }
    for (const [clave, registro] of RateLimitVerificacionGuard.registros) {
      if (registro.expira < ahora) {
        RateLimitVerificacionGuard.registros.delete(clave);
      }
    }
  }
}
