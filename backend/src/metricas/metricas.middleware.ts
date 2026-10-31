import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricasService } from './metricas.service';

/** Rutas que no se cuentan para no contaminar la medición con el propio panel. */
const RUTAS_EXCLUIDAS = ['/metricas', '/health', '/favicon.ico'];

function normalizarRuta(req: Request): string {
  const original = (req.originalUrl || req.url || '/').split('?')[0];
  if (
    RUTAS_EXCLUIDAS.some(
      (prefijo) => original === prefijo || original.startsWith(`${prefijo}/`),
    )
  ) {
    return '';
  }
  if (/\.(?:js|css|png|jpe?g|gif|svg|ico|woff2?|map)$/i.test(original)) {
    return '/estatico';
  }

  const base = (req.baseUrl || '').replace(/\/+$/, '');
  const patron = (req as Request & { route?: { path?: string } }).route?.path;
  let ruta = patron ? `${base}${patron}` : original;
  ruta = ruta.replace(/\/\/+/g, '/');
  // Evita una entrada distinta por cada id numérico o UUID.
  ruta = ruta
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
      '/:uuid',
    );
  return (ruta || '/').slice(0, 160);
}

@Injectable()
export class MetricasMiddleware implements NestMiddleware {
  constructor(private readonly metricas: MetricasService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const ruta = normalizarRuta(req);
    if (!ruta) {
      next();
      return;
    }
    const inicio = process.hrtime.bigint();
    let registrada = false;
    res.once('finish', () => {
      if (registrada) return;
      registrada = true;
      const duracionMs = Number(process.hrtime.bigint() - inicio) / 1_000_000;
      this.metricas.registrar({
        metodo: req.method,
        ruta,
        estado: res.statusCode,
        duracionMs,
        requestId: (req as Request & { requestId?: string }).requestId,
      });
    });
    next();
  }
}
