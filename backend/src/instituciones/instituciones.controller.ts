import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { InstitucionesService } from './instituciones.service';
import { UpdateInstitucionDto } from './dto/update-institucion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('instituciones')
@UseGuards(JwtAuthGuard)
export class InstitucionesController {
  constructor(private readonly institucionesService: InstitucionesService) {}

  @Get()
  listar(@CurrentUser('sub') usuarioId: number) {
    return this.institucionesService.listar(usuarioId);
  }

  @Get('mia')
  obtenerMia(@CurrentUser('sub') usuarioId: number) {
    return this.institucionesService.obtenerMia(usuarioId);
  }

  @Get(':id/materias')
  listarMaterias(@Param('id', ParseIntPipe) id: number) {
    return this.institucionesService.listarMaterias(id);
  }

  @Patch('mia')
  actualizarMia(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: UpdateInstitucionDto,
  ) {
    return this.institucionesService.actualizarMia(usuarioId, dto);
  }
}
