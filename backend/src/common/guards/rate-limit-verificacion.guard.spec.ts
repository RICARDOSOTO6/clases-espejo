import { ExecutionContext, HttpException } from '@nestjs/common';
import { RateLimitVerificacionGuard } from './rate-limit-verificacion.guard';

function contexto(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitVerificacionGuard', () => {
  beforeEach(() => {
    RateLimitVerificacionGuard.reiniciar();
  });

  it('permite 60 consultas por minuto y bloquea la 61', () => {
    const guard = new RateLimitVerificacionGuard();
    const ctx = contexto('192.0.2.10');

    for (let i = 1; i <= 60; i += 1) {
      expect(guard.canActivate(ctx)).toBe(true);
    }

    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    try {
      guard.canActivate(ctx);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it('cuenta por IP: otra IP no queda bloqueada', () => {
    const guard = new RateLimitVerificacionGuard();
    const primera = contexto('192.0.2.11');

    for (let i = 1; i <= 61; i += 1) {
      try {
        guard.canActivate(primera);
      } catch {
        // La 61 falla, como se espera.
      }
    }

    expect(guard.canActivate(contexto('192.0.2.12'))).toBe(true);
  });
});
