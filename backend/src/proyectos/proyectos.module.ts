import { Module } from '@nestjs/common';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { DocenteParticipanteGuard } from './guards/docente-participante.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProyectosController],
  providers: [ProyectosService, DocenteParticipanteGuard],
})
export class ProyectosModule {}
