import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AgentesService } from './agentes.service';
import { InviteDocenteDto } from './dto/invite-docente.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('agentes')
export class AgentesController {
  constructor(private readonly agentesService: AgentesService) {}

  @Post('invitar-docente')
  @UseGuards(JwtAuthGuard)
  invitarDocente(
    @CurrentUser('sub') agenteId: number,
    @Body() dto: InviteDocenteDto,
  ) {
    return this.agentesService.invitarDocente(agenteId, dto);
  }
}
