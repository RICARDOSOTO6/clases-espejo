import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AsignacionesService } from './asignaciones.service';
import { CreateAsignacionDto } from './dto/create-asignacion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('asignaciones')
@UseGuards(JwtAuthGuard)
export class AsignacionesController {
  constructor(private readonly asignacionesService: AsignacionesService) {}

  @Get()
  listar(@CurrentUser('sub') agenteId: number) {
    return this.asignacionesService.listar(agenteId);
  }

  @Get('mias')
  listarMias(@CurrentUser('sub') usuarioId: number) {
    return this.asignacionesService.listarMias(usuarioId);
  }

  @Post()
  crear(@CurrentUser('sub') agenteId: number, @Body() dto: CreateAsignacionDto) {
    return this.asignacionesService.crear(agenteId, dto);
  }

  @Delete(':id')
  eliminar(
    @CurrentUser('sub') agenteId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.asignacionesService.eliminar(agenteId, id);
  }
}
