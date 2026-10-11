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
import { MiembrosCaceService } from './miembros-cace.service';
import {
  ActualizarMiembroCaceDto,
  CrearMiembroCaceDto,
} from './dto/miembro-cace.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';

/**
 * Miembros de la CACE: la presidencia da de alta secretarías y las activa o
 * desactiva.
 *
 * Todo el controlador pide la misma capacidad, `gestionarMiembrosCace`, que
 * **solo** tiene la presidencia: repartir los cargos de la CACE es suyo y de
 * nadie más. La secretaría no puede ni verlo (403), que es lo que evita que se
 * reparta permisos sola.
 */
@Controller('cace/miembros')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
@Requiere('gestionarMiembrosCace')
export class MiembrosCaceController {
  constructor(private readonly miembros: MiembrosCaceService) {}

  @Get()
  listar() {
    return this.miembros.listar();
  }

  @Post()
  crear(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: CrearMiembroCaceDto,
  ) {
    return this.miembros.crear(usuarioId, dto);
  }

  @Patch(':id')
  cambiarActivo(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarMiembroCaceDto,
  ) {
    return this.miembros.cambiarActivo(usuarioId, id, dto);
  }
}
