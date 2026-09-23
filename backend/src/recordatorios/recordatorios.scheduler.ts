import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SolicitudesService } from '../solicitudes/solicitudes.service';

/** Cada cuánto se revisa si alguna solicitud venció (30 minutos). */
const INTERVALO_MS = 30 * 60 * 1000;

/**
 * Revisa el vencimiento de las solicitudes aunque nadie abra la aplicación.
 *
 * No se añadió `@nestjs/schedule` para no sumar dependencias: basta un
 * intervalo en proceso. Además, el servicio de solicitudes vuelve a comprobar
 * los plazos cada vez que alguien lista, así que la información nunca está
 * desactualizada aunque el proceso se reinicie.
 */
@Injectable()
export class RecordatoriosScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecordatoriosScheduler.name);
  private temporizador?: NodeJS.Timeout;

  constructor(private readonly solicitudes: SolicitudesService) {}

  onModuleInit(): void {
    void this.revisar();
    this.temporizador = setInterval(() => void this.revisar(), INTERVALO_MS);
    // No debe impedir que el proceso termine.
    this.temporizador.unref?.();
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  private async revisar(): Promise<void> {
    try {
      const caducadas = await this.solicitudes.caducarVencidas();
      if (caducadas > 0) {
        this.logger.log(
          `${caducadas} solicitud(es) caducaron por falta de respuesta`,
        );
      }
    } catch (error) {
      // Un fallo aquí no debe tumbar el servicio.
      this.logger.error(
        `No se pudo revisar el vencimiento de solicitudes: ${(error as Error).message}`,
      );
    }
  }
}
