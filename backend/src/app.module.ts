import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { AgentesModule } from './agentes/agentes.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { MateriasModule } from './materias/materias.module';
import { AsignacionesModule } from './asignaciones/asignaciones.module';
import { InstitucionesModule } from './instituciones/instituciones.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { ProyectosModule } from './proyectos/proyectos.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AuthModule,
    AgentesModule,
    UsuariosModule,
    MateriasModule,
    AsignacionesModule,
    InstitucionesModule,
    SolicitudesModule,
    ProyectosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
