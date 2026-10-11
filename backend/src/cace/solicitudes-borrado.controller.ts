import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SolicitudesBorradoService } from './solicitudes-borrado.service';
import {
  ResolverSolicitudBorradoDto,
  SolicitarBorradoInstitucionDto,
} from './dto/solicitud-borrado.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';

/**
 * Borrado de instituciones con autorización de la presidencia.
 *
 * Va en su propio controlador porque aquí conviven tres permisos distintos:
 * **pedir** el borrado (`solicitarBorradoInstitucion`, de la secretaría),
 * **resolverlo** (`resolverSolicitudesBorrado`, de la presidencia) y **verlo**
 * (cualquiera de los dos, cada uno lo suyo). Poner un `@Requiere` en la clase
 * dejaría fuera a uno de los dos roles, así que cada ruta pide el suyo.
 *
 * La ruta de la petición cuelga de `/cace/instituciones/:id/...` a propósito: es
 * donde el presidente tiene el botón de borrado directo, y así se lee que son el
 * mismo borrado con dos caminos.
 */
@Controller('cace')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
export class SolicitudesBorradoController {
  constructor(private readonly solicitudes: SolicitudesBorradoService) {}

  /**
   * La secretaría pide el borrado de una institución rechazada, con motivo.
   */
  @Post('instituciones/:id/solicitud-borrado')
  @Requiere('solicitarBorradoInstitucion')
  pedir(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SolicitarBorradoInstitucionDto,
  ) {
    return this.solicitudes.pedir(usuarioId, id, dto);
  }

  /**
   * Listado. La presidencia ve las pendientes y el historial; la secretaría,
   * las que pidió ella.
   */
  @Get('solicitudes-borrado')
  listar(@CurrentUser('sub') usuarioId: number) {
    return this.solicitudes.listar(usuarioId);
  }

  /**
   * El presidente aprueba (y entonces se borra) o rechaza (con motivo).
   */
  @Patch('solicitudes-borrado/:id')
  @Requiere('resolverSolicitudesBorrado')
  resolver(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolverSolicitudBorradoDto,
  ) {
    return this.solicitudes.resolver(usuarioId, id, dto);
  }
}
