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
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { InstitucionesService, LOGOS_DIR } from './instituciones.service';
import { UpdateInstitucionDto } from './dto/update-institucion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// Igual que en la foto de perfil: solo imágenes de mapa de bits. Un SVG puede
// llevar código dentro y se ejecutaría en el mismo origen que la aplicación.
const EXTENSIONES_LOGO = ['.png', '.jpg', '.jpeg', '.webp'];
const TAMANO_MAXIMO = 2 * 1024 * 1024;

const LOGO_MULTER = {
  storage: diskStorage({
    destination: LOGOS_DIR,
    filename: (_req: any, file: any, cb: any) => {
      // Nombre aleatorio: evita colisiones y no expone el nombre original.
      const nombre = `logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname).toLowerCase()}`;
      cb(null, nombre);
    },
  }),
  limits: { fileSize: TAMANO_MAXIMO },
  fileFilter: (_req: any, file: any, cb: any) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_LOGO.includes(extension)) {
      return cb(
        new BadRequestException(
          `Formato no permitido (${extension || 'sin extensión'}). El logo debe ser PNG, JPG o WEBP.`,
        ),
        false,
      );
    }
    cb(null, true);
  },
};

@Controller('instituciones')
@UseGuards(JwtAuthGuard)
export class InstitucionesController {
  constructor(private readonly institucionesService: InstitucionesService) {
    // La carpeta debe existir antes de que llegue la primera subida.
    mkdirSync(LOGOS_DIR, { recursive: true });
  }

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

  @Post('mia/logo')
  @UseInterceptors(FileInterceptor('logo', LOGO_MULTER))
  subirLogo(
    @CurrentUser('sub') usuarioId: number,
    @UploadedFile() archivo: any,
  ) {
    if (!archivo) {
      throw new BadRequestException(
        'Adjunta una imagen en el campo «logo» (PNG, JPG o WEBP, hasta 2 MB)',
      );
    }
    return this.institucionesService.guardarLogo(usuarioId, archivo);
  }

  @Delete('mia/logo')
  quitarLogo(@CurrentUser('sub') usuarioId: number) {
    return this.institucionesService.quitarLogo(usuarioId);
  }
}

/**
 * Directorio de instituciones para el **registro**.
 *
 * Va sin guardia a propósito: quien se está registrando todavía no tiene cuenta
 * y es justo quien tiene que buscar su institución antes de crear una nueva.
 * Solo expone lo necesario para reconocerla (nombre, país, logo y estado ante la
 * CACE).
 */
@Controller('instituciones')
export class DirectorioInstitucionesController {
  constructor(private readonly institucionesService: InstitucionesService) {}

  @Get('directorio')
  directorio(@Query('q') q?: string) {
    return this.institucionesService.directorio(q);
  }
}
