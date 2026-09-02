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
import { MateriasService } from './materias.service';
import { CreateMateriaDto } from './dto/create-materia.dto';
import { UpdateMateriaDto } from './dto/update-materia.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('materias')
@UseGuards(JwtAuthGuard)
export class MateriasController {
  constructor(private readonly materiasService: MateriasService) {}

  @Get()
  listar(@CurrentUser('sub') agenteId: number) {
    return this.materiasService.listar(agenteId);
  }

  @Get(':id')
  obtener(
    @CurrentUser('sub') agenteId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.materiasService.obtener(agenteId, id);
  }

  @Post()
  crear(@CurrentUser('sub') agenteId: number, @Body() dto: CreateMateriaDto) {
    return this.materiasService.crear(agenteId, dto);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser('sub') agenteId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMateriaDto,
  ) {
    return this.materiasService.actualizar(agenteId, id, dto);
  }

  @Delete(':id')
  eliminar(
    @CurrentUser('sub') agenteId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.materiasService.eliminar(agenteId, id);
  }
}
