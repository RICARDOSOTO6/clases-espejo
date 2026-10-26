import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SeguridadCabecerasMiddleware } from './common/seguridad-cabeceras.middleware';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { AgentesModule } from './agentes/agentes.module';
import { SecretariasModule } from './secretarias/secretarias.module';
import { InvitacionesAgenteModule } from './invitaciones-agente/invitaciones-agente.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { MateriasModule } from './materias/materias.module';
import { AsignacionesModule } from './asignaciones/asignaciones.module';
import { InstitucionesModule } from './instituciones/instituciones.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { RecordatoriosModule } from './recordatorios/recordatorios.module';
import { CaceModule } from './cace/cace.module';
import { CertificadosModule } from './certificados/certificados.module';
import { EnviosModule } from './envios/envios.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    EnviosModule,
    CaceModule,
    CertificadosModule,
    AuthModule,
    AgentesModule,
    SecretariasModule,
    InvitacionesAgenteModule,
    UsuariosModule,
    MateriasModule,
    AsignacionesModule,
    InstitucionesModule,
    SolicitudesModule,
    ProyectosModule,
    RecordatoriosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SeguridadCabecerasMiddleware).forRoutes('*');
  }
}
