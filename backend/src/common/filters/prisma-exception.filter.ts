import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

/**
 * Traduce los errores de integridad de Prisma a respuestas legibles, en vez del
 * 500 opaco que salía antes de este filtro.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    const mapa: Record<string, { status: number; mensaje: string }> = {
      P2002: {
        status: HttpStatus.CONFLICT,
        mensaje: 'Ya existe un registro con esos datos',
      },
      P2003: {
        status: HttpStatus.BAD_REQUEST,
        mensaje:
          'La operación afecta a datos relacionados: revísalos antes de continuar',
      },
      P2025: {
        status: HttpStatus.NOT_FOUND,
        mensaje: 'El registro indicado no existe',
      },
    };

    const entrada = mapa[exception.code] ?? {
      status: HttpStatus.BAD_REQUEST,
      mensaje: 'No se pudo completar la operación por un problema de datos',
    };

    response.status(entrada.status).json({
      statusCode: entrada.status,
      message: entrada.mensaje,
      error: exception.code,
    });
  }
}
