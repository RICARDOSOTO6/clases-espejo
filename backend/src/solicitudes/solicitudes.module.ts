import { Module } from '@nestjs/common';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  // El módulo de recordatorios reutiliza el listado y el cálculo de plazos.
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
