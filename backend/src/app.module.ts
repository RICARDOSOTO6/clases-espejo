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

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AuthModule,
    AgentesModule,
    UsuariosModule,
    MateriasModule,
    AsignacionesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
