import { Module } from '@nestjs/common';
import { EnviosController } from './envios.controller';
import { EnviosCorreoService } from './envios.service';

/**
 * Cola de correo de la Fase 2. `PrismaModule` y `MailModule` son globales, así
 * que aquí solo viven el servicio (worker incluido) y su controlador de progreso.
 */
@Module({
  controllers: [EnviosController],
  providers: [EnviosCorreoService],
  exports: [EnviosCorreoService],
})
export class EnviosModule {}
