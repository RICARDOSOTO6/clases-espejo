import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateEstadoDocenteDto } from '../agentes/dto/update-estado.dto';
import { resolverUrlPublica } from '../common/url-publica';
import { SecretariasService } from './secretarias.service';
import { CrearInvitacionSecretariaDto } from './dto/crear-invitacion-secretaria.dto';
import { ActivarSecretariaDto } from './dto/activar-secretaria.dto';
import { ActualizarContactoInstitucionDto } from './dto/actualizar-contacto.dto';
import { InvitarDocenteSecretariaDto } from './dto/invitar-docente.dto';

/**
 * Panel de la secretaría de institución y creación de su invitación.
 *
 * La invitación la crea el agente principal; el resto de rutas exigen que la
 * cuenta sea una secretaría activa. La autorización fina vive en el servicio,
 * porque la secretaría no administra clases ni certificados.
 */
@Controller('secretarias')
@UseGuards(JwtAuthGuard)
export class SecretariasController {
  constructor(private readonly secretarias: SecretariasService) {}

  @Post('invitacion')
  crearInvitacion(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: CrearInvitacionSecretariaDto,
    @Req() peticion: Request,
  ) {
    return this.secretarias.crearInvitacion(
      usuarioId,
      dto,
      resolverUrlPublica(peticion),
    );
  }

  @Get('institucion')
  perfil(@CurrentUser('sub') usuarioId: number) {
    return this.secretarias.perfil(usuarioId);
  }

  @Patch('institucion')
  actualizarContacto(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: ActualizarContactoInstitucionDto,
  ) {
    return this.secretarias.actualizarContacto(usuarioId, dto);
  }

  @Get('docentes')
  listarDocentes(@CurrentUser('sub') usuarioId: number) {
    return this.secretarias.listarDocentes(usuarioId);
  }

  @Post('invitar-docente')
  invitarDocente(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: InvitarDocenteSecretariaDto,
    @Req() peticion: Request,
  ) {
    return this.secretarias.invitarDocente(
      usuarioId,
      dto,
      resolverUrlPublica(peticion),
    );
  }

  @Patch('docentes/:id/estado')
  cambiarEstadoDocente(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoDocenteDto,
  ) {
    return this.secretarias.cambiarEstadoDocente(usuarioId, id, dto.activo);
  }

  @Get('resumen')
  resumen(@CurrentUser('sub') usuarioId: number) {
    return this.secretarias.resumen(usuarioId);
  }
}

/** Rutas públicas del enlace de invitación. */
@Controller('auth')
export class InvitacionSecretariaPublicaController {
  constructor(private readonly secretarias: SecretariasService) {}

  @Get('invitacion-secretaria')
  validar(@Query('token') token: string) {
    return this.secretarias.validarInvitacion(token);
  }

  @Post('activar-secretaria')
  activar(@Body() dto: ActivarSecretariaDto) {
    return this.secretarias.activar(dto);
  }
}
