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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ProyectosService } from './proyectos.service';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { CreateProyectoDocenteDto } from './dto/create-proyecto-docente.dto';
import { SavePlanificacionDto } from './dto/save-planificacion.dto';
import { CreateReportePlanificacionDto } from './dto/create-reporte-planificacion.dto';
import { CreateMensajeDto } from './dto/create-mensaje.dto';
import { CreateSesionDto } from './dto/create-sesion.dto';
import { UpdateSesionDto } from './dto/update-sesion.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// Configuración de subida de evidencias: solo archivos, máx. 10 MB,
// guardados en backend/uploads con nombre único.
const EVIDENCIAS_MULTER = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads'),
    filename: (_req: any, file: any, cb: any) => {
      const nombre = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
      cb(null, nombre);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
};

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

  @Get(':id/sesiones')
  listarSesiones(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.proyectosService.listarSesiones(usuarioId, id);
  }

  @Post(':id/sesiones')
  crearSesion(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSesionDto,
  ) {
    return this.proyectosService.crearSesion(usuarioId, id, dto);
  }

  @Patch(':id/sesiones/:sesionId')
  actualizarSesion(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('sesionId', ParseIntPipe) sesionId: number,
    @Body() dto: UpdateSesionDto,
  ) {
    return this.proyectosService.actualizarSesion(usuarioId, id, sesionId, dto);
  }

  @Delete(':id/sesiones/:sesionId')
  eliminarSesion(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('sesionId', ParseIntPipe) sesionId: number,
  ) {
    return this.proyectosService.eliminarSesion(usuarioId, id, sesionId);
  }

  @Get(':id/actividades')
  listarActividades(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.proyectosService.listarActividades(usuarioId, id);
  }

  @Post(':id/actividades')
  crearActividad(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateActividadDto,
  ) {
    return this.proyectosService.crearActividad(usuarioId, id, dto);
  }

  @Patch(':id/actividades/:actividadId')
  actualizarActividad(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('actividadId', ParseIntPipe) actividadId: number,
    @Body() dto: UpdateActividadDto,
  ) {
    return this.proyectosService.actualizarActividad(
      usuarioId,
      id,
      actividadId,
      dto,
    );
  }

  @Delete(':id/actividades/:actividadId')
  eliminarActividad(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('actividadId', ParseIntPipe) actividadId: number,
  ) {
    return this.proyectosService.eliminarActividad(usuarioId, id, actividadId);
  }

  @Get(':id/evidencias')
  listarEvidencias(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.proyectosService.listarEvidencias(usuarioId, id);
  }

  @Post(':id/evidencias')
  @UseInterceptors(FileInterceptor('archivo', EVIDENCIAS_MULTER))
  crearEvidencia(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: any,
    @Body() dto: CreateEvidenciaDto,
  ) {
    return this.proyectosService.crearEvidencia(usuarioId, id, dto, archivo);
  }
}
