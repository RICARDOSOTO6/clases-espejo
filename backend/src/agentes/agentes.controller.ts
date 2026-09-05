import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AgentesService } from './agentes.service';
import { InviteDocenteDto } from './dto/invite-docente.dto';
import { UpdateEstadoDocenteDto } from './dto/update-estado.dto';
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

  @Get('docentes')
  @UseGuards(JwtAuthGuard)
  listarDocentes(@CurrentUser('sub') agenteId: number) {
    return this.agentesService.listarDocentes(agenteId);
  }

  @Patch('docentes/:id/estado')
  @UseGuards(JwtAuthGuard)
  cambiarEstado(
    @CurrentUser('sub') agenteId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoDocenteDto,
  ) {
    return this.agentesService.cambiarEstadoDocente(agenteId, id, dto.activo);
  }

  @Delete('docentes/:id')
  @UseGuards(JwtAuthGuard)
  eliminarDocente(
    @CurrentUser('sub') agenteId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.agentesService.eliminarDocente(agenteId, id);
  }
}
