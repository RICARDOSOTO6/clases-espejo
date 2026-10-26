import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  InvitacionSecretariaPublicaController,
  SecretariasController,
} from './secretarias.controller';
import { SecretariasService } from './secretarias.service';

@Module({
  imports: [AuthModule],
  controllers: [SecretariasController, InvitacionSecretariaPublicaController],
  providers: [SecretariasService],
})
export class SecretariasModule {}
