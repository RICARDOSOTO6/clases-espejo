import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Añade un identificador por petición (`X-Request-Id`) y registra los 5xx.
 *
 * Se aplica como middleware de Nest para que también lo reciban las pruebas
 * e2e y cualquier ruta de la API. Si el cliente manda un id corto y válido, se
 * respeta para poder cruzar logs entre servicios.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const recibido = req.headers['x-request-id'];
    const id =
      typeof recibido === 'string' && recibido.length <= 128 && recibido.trim()
        ? recibido
        : randomUUID();

    (req as Request & { requestId?: string }).requestId = id;
    res.setHeader('X-Request-Id', id);

    res.on('finish', () => {
      if (res.statusCode >= 500) {
        this.logger.error(
          `${req.method} ${req.originalUrl} ${res.statusCode} requestId=${id}`,
        );
      }
    });

    next();
  }
}
