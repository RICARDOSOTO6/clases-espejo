import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InstitucionesCaceService } from './instituciones-cace.service';
import { DecisionInstitucionDto } from './dto/decision-institucion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';

/**
 * Gestión de instituciones por parte de la presidencia de la CACE.
 *
 * Va en su propio prefijo (`/cace/…`) para no mezclarlo con el catálogo que ven
 * agentes y docentes en `/instituciones`. El guardia de capacidades va **después**
 * del de autenticación, que es quien deja el usuario en la petición.
 */
@Controller('cace/instituciones')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
@Requiere('aprobarInstituciones')
export class InstitucionesCaceController {
  constructor(
    private readonly institucionesCaceService: InstitucionesCaceService,
  ) {}

  @Get()
  listar() {
    return this.institucionesCaceService.listar();
  }

  @Post(':id/aprobar')
  aprobar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.institucionesCaceService.aprobar(usuarioId, id);
  }

  @Post(':id/rechazar')
  rechazar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionInstitucionDto,
  ) {
    return this.institucionesCaceService.rechazar(usuarioId, id, dto);
  }

  @Post(':id/vetar')
  vetar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionInstitucionDto,
  ) {
    return this.institucionesCaceService.vetar(usuarioId, id, dto);
  }

  @Post(':id/reactivar')
  reactivar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.institucionesCaceService.reactivar(usuarioId, id);
  }
}
