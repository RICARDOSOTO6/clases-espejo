import { Module } from '@nestjs/common';
import { SolicitudesModule } from '../solicitudes/solicitudes.module';
import { RecordatoriosController } from './recordatorios.controller';
import { RecordatoriosService } from './recordatorios.service';
import { RecordatoriosScheduler } from './recordatorios.scheduler';

/**
 * La agenda reutiliza el servicio de solicitudes para no duplicar las reglas de
 * acceso ni el cálculo de plazos.
 */
@Module({
  imports: [SolicitudesModule],
  controllers: [RecordatoriosController],
  providers: [RecordatoriosService, RecordatoriosScheduler],
  exports: [RecordatoriosService],
})
export class RecordatoriosModule {}
