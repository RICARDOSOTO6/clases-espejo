import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Cabeceras de seguridad para toda la aplicación.
 *
 * Se aplican en `main.ts` (también a los estáticos) y como middleware de Nest
 * (para las pruebas e2e y las rutas de la API). No se añade `helmet` para no
 * sumar una dependencia: son cabeceras fijas y el CSP se revisa aquí.
 *
 * El CSP permite lo que el build de Angular necesita:
 * - `style-src 'unsafe-inline'` por el `<style>` con las fuentes del `index.html`.
 * - `font-src` de Google Fonts (gstatic) y las fuentes locales.
 * - `img-src` con `data:`/`blob:` para QR, avatares y vistas previas.
 *
 * HSTS solo se envía en producción: activarlo en `localhost` complica el
 * desarrollo y no aporta nada sin HTTPS.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
].join('; ');

export function aplicarCabecerasSeguridad(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  if (process.env.NODE_ENV === 'production' && process.env.HSTS !== 'false') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=15552000; includeSubDomains',
    );
  }

  next();
}

@Injectable()
export class SeguridadCabecerasMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    aplicarCabecerasSeguridad(req, res, next);
  }
}
