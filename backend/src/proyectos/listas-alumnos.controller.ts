import {
  BadRequestException,
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
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  EditarAlumnoDto,
  GuardarListaDto,
  PrevisualizarListaDto,
} from './dto/listas-alumnos.dto';
import { ListasAlumnosService } from './listas-alumnos.service';

/**
 * La lista se lee en memoria, no en disco: solo se quiere el texto de las
 * celdas, así que no hay razón para dejar archivos temporales en el servidor.
 */
const ARCHIVO_MULTER = {
  storage: memoryStorage(),
  limits: { fileSize: ListasAlumnosService.maximoBytes },
  fileFilter: (_req: any, file: any, cb: any) => {
    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.xlsx' && extension !== '.csv') {
      return cb(
        new BadRequestException(
          `Solo se aceptan listas en Excel (.xlsx) o CSV (.csv); llegó ${extension || 'un archivo sin extensión'}.`,
        ),
        false,
      );
    }
    cb(null, true);
  },
};

/**
 * Lista de alumnos de una clase espejo, por institución.
 *
 * La usa el docente participante para subir **sus** alumnos; de ahí saldrán los
 * certificados al cerrar la clase.
 */
@Controller('proyectos/:id/listas-alumnos')
@UseGuards(JwtAuthGuard)
export class ListasAlumnosController {
  constructor(private readonly listas: ListasAlumnosService) {}

  /** La lista guardada de la institución del docente (o `null`). */
  @Get()
  obtener(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.listas.obtener(usuarioId, id);
  }

  /** Lee el archivo o el texto pegado y devuelve la vista previa, sin guardar. */
  @Post('previsualizar')
  @UseInterceptors(FileInterceptor('archivo', ARCHIVO_MULTER))
  previsualizar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: { buffer: Buffer; originalname: string } | undefined,
    @Body() dto: PrevisualizarListaDto,
  ) {
    return this.listas.previsualizar(usuarioId, id, archivo, dto.texto);
  }

  /** Guarda la lista revisada, reemplazando la anterior si la había. */
  @Put()
  guardar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarListaDto,
  ) {
    return this.listas.guardar(usuarioId, id, dto);
  }

  /** Corrige un alumno (nombre, matrícula, correo o si entra en los certificados). */
  @Patch('alumnos/:alumnoId')
  editar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
    @Body() dto: EditarAlumnoDto,
  ) {
    return this.listas.editarAlumno(usuarioId, id, alumnoId, dto);
  }

  /** Saca a un alumno de la lista. */
  @Delete('alumnos/:alumnoId')
  eliminar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
  ) {
    return this.listas.eliminarAlumno(usuarioId, id, alumnoId);
  }
}
