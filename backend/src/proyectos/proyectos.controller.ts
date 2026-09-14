import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { CreateProyectoDocenteDto } from './dto/create-proyecto-docente.dto';
import { SavePlanificacionDto } from './dto/save-planificacion.dto';
import { CreateReportePlanificacionDto } from './dto/create-reporte-planificacion.dto';
import { CreateMensajeDto } from './dto/create-mensaje.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('proyectos')
@UseGuards(JwtAuthGuard)
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Get('mios')
  listarParaDocente(@CurrentUser('sub') usuarioId: number) {
    return this.proyectosService.listarParaDocente(usuarioId);
  }

  @Get('institucion')
  listarParaAgente(@CurrentUser('sub') usuarioId: number) {
    return this.proyectosService.listarParaAgente(usuarioId);
  }

  @Get(':id')
  obtener(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.proyectosService.obtener(usuarioId, id);
  }

  @Get(':id/mensajes')
  listarMensajes(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.proyectosService.listarMensajes(usuarioId, id);
  }

  @Post(':id/mensajes')
  enviarMensaje(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMensajeDto,
  ) {
    return this.proyectosService.enviarMensaje(usuarioId, id, dto);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProyectoDto,
  ) {
    return this.proyectosService.actualizar(usuarioId, id, dto);
  }

  @Post(':id/docentes')
  agregarDocente(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProyectoDocenteDto,
  ) {
    return this.proyectosService.agregarDocente(usuarioId, id, dto);
  }

  @Delete(':id/docentes/:proyectoDocenteId')
  quitarDocente(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('proyectoDocenteId', ParseIntPipe) proyectoDocenteId: number,
  ) {
    return this.proyectosService.quitarDocente(
      usuarioId,
      id,
      proyectoDocenteId,
    );
  }

  @Put(':id/planificacion')
  guardarPlanificacion(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SavePlanificacionDto,
  ) {
    return this.proyectosService.guardarPlanificacion(usuarioId, id, dto);
  }

  @Post(':id/planificacion/confirmar')
  confirmarParticipacion(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.proyectosService.confirmarParticipacion(usuarioId, id);
  }

  @Get(':id/reportes')
  listarReportes(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.proyectosService.listarReportes(usuarioId, id);
  }

  @Post(':id/reportes')
  generarReporte(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReportePlanificacionDto,
  ) {
    return this.proyectosService.generarReporte(usuarioId, id, dto);
  }
}
