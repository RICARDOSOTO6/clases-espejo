import { Module } from '@nestjs/common';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { ResumenPdfService } from './resumen-pdf.service';
import { CalendarioIcsService } from './calendario-ics.service';
import { DocenteParticipanteGuard } from './guards/docente-participante.guard';
import { ListasAlumnosController } from './listas-alumnos.controller';
import { ListasAlumnosService } from './listas-alumnos.service';
import { AuthModule } from '../auth/auth.module';
import { EnviosModule } from '../envios/envios.module';

@Module({
  imports: [AuthModule, EnviosModule],
  controllers: [ProyectosController, ListasAlumnosController],
  providers: [
    ProyectosService,
    ResumenPdfService,
    CalendarioIcsService,
    DocenteParticipanteGuard,
    ListasAlumnosService,
  ],
})
export class ProyectosModule {}
