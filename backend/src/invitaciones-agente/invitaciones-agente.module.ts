import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  InvitacionAgentePublicaController,
  InvitacionesAgenteController,
} from './invitaciones-agente.controller';
import { InvitacionesAgenteService } from './invitaciones-agente.service';

@Module({
  imports: [AuthModule],
  controllers: [
    InvitacionesAgenteController,
    InvitacionAgentePublicaController,
  ],
  providers: [InvitacionesAgenteService],
})
export class InvitacionesAgenteModule {}
