import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AgentesService } from './agentes.service';
import { InviteDocenteDto } from './dto/invite-docente.dto';
import { UpdateEstadoDocenteDto } from './dto/update-estado.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { resolverUrlPublica } from '../common/url-publica';

@Controller('agentes')
export class AgentesController {
  constructor(private readonly agentesService: AgentesService) {}

  @Post('invitar-docente')
  @UseGuards(JwtAuthGuard)
  invitarDocente(
    @CurrentUser('sub') agenteId: number,
    @Body() dto: InviteDocenteDto,
    @Req() peticion: Request,
  ) {
    // El enlace del correo debe apuntar a donde está el docente: el dominio o el
    // túnel desde el que se está usando la aplicación, no a localhost.
    return this.agentesService.invitarDocente(
      agenteId,
      dto,
      resolverUrlPublica(peticion),
    );
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
