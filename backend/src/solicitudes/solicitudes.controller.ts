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
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('solicitudes')
@UseGuards(JwtAuthGuard)
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  crear(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: CreateSolicitudDto,
  ) {
    return this.solicitudesService.crear(usuarioId, dto);
  }

  @Get('mias')
  listarMias(@CurrentUser('sub') usuarioId: number) {
    return this.solicitudesService.listarMias(usuarioId);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSolicitudDto,
  ) {
    return this.solicitudesService.actualizar(usuarioId, id, dto);
  }

  @Delete(':id')
  cancelar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.solicitudesService.cancelar(usuarioId, id);
  }
}
