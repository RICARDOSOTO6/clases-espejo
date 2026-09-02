import { Module } from '@nestjs/common';
import { AgentesController } from './agentes.controller';
import { AgentesService } from './agentes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AgentesController],
  providers: [AgentesService],
})
export class AgentesModule {}
