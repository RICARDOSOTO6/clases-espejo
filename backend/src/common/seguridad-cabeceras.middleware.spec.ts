import { NextFunction, Request, Response } from 'express';
import {
  CONTENT_SECURITY_POLICY,
  aplicarCabecerasSeguridad,
} from './seguridad-cabeceras.middleware';

describe('cabeceras de seguridad', () => {
  function ejecutar(env: NodeJS.ProcessEnv = {}) {
    const original = { ...process.env };
    Object.assign(process.env, env);
    const cabeceras = new Map<string, string>();
    const res = {
      setHeader: (nombre: string, valor: string) => {
        cabeceras.set(nombre, valor);
      },
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    aplicarCabecerasSeguridad({} as Request, res, next);

    process.env = original;
    return { cabeceras, next };
  }

  it('aplica CSP y cabeceras básicas', () => {
    const { cabeceras, next } = ejecutar();
    expect(next).toHaveBeenCalled();
    expect(cabeceras.get('Content-Security-Policy')).toBe(
      CONTENT_SECURITY_POLICY,
    );
    expect(cabeceras.get('X-Content-Type-Options')).toBe('nosniff');
    expect(cabeceras.get('X-Frame-Options')).toBe('DENY');
    expect(cabeceras.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(cabeceras.get('Permissions-Policy')).toContain('camera=()');
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain('https://fonts.gstatic.com');
  });

  it('no manda HSTS fuera de producción', () => {
    const { cabeceras } = ejecutar({
      NODE_ENV: 'development',
      HSTS: 'true',
    });
    expect(cabeceras.has('Strict-Transport-Security')).toBe(false);
  });

  it('manda HSTS en producción salvo que se desactive', () => {
    const { cabeceras } = ejecutar({ NODE_ENV: 'production' });
    expect(cabeceras.get('Strict-Transport-Security')).toContain('max-age=');

    const desactivado = ejecutar({
      NODE_ENV: 'production',
      HSTS: 'false',
    });
    expect(desactivado.cabeceras.has('Strict-Transport-Security')).toBe(false);
  });
});
