import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { resolverUrlPublica } from '../common/url-publica';
import { InvitacionesAgenteService } from './invitaciones-agente.service';
import { ActivarInvitacionAgenteDto } from './dto/activar-invitacion-agente.dto';

/** Creación y gestión de invitaciones de agente por la presidencia. */
@Controller('cace/invitaciones-agente')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
@Requiere('aprobarInstituciones')
export class InvitacionesAgenteController {
  constructor(private readonly invitaciones: InvitacionesAgenteService) {}

  @Post()
  crear(@CurrentUser('sub') usuarioId: number, @Req() peticion: Request) {
    return this.invitaciones.crear(usuarioId, resolverUrlPublica(peticion));
  }

  @Get()
  listar() {
    return this.invitaciones.listarPendientes();
  }

  @Delete(':id')
  revocar(@Param('id', ParseIntPipe) id: number) {
    return this.invitaciones.revocar(id);
  }
}

/** Rutas públicas que consume el cuestionario del agente. */
@Controller('auth')
export class InvitacionAgentePublicaController {
  constructor(private readonly invitaciones: InvitacionesAgenteService) {}

  @Get('invitacion-agente')
  validar(@Query('token') token: string) {
    return this.invitaciones.validar(token);
  }

  @Post('activar-agente')
  activar(@Body() dto: ActivarInvitacionAgenteDto) {
    return this.invitaciones.activar(dto);
  }
}
