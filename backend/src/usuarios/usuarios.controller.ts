import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { UsuariosService, AVATARES_DIR } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// Solo imágenes de mapa de bits: un SVG puede llevar código dentro y se
// ejecutaría en el mismo origen que la aplicación.
const EXTENSIONES_FOTO = ['.png', '.jpg', '.jpeg', '.webp'];
const TAMANO_MAXIMO = 2 * 1024 * 1024;

const FOTO_MULTER = {
  storage: diskStorage({
    destination: AVATARES_DIR,
    filename: (_req: any, file: any, cb: any) => {
      // Nombre aleatorio: evita colisiones y no expone el nombre original.
      const nombre = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname).toLowerCase()}`;
      cb(null, nombre);
    },
  }),
  limits: { fileSize: TAMANO_MAXIMO },
  fileFilter: (_req: any, file: any, cb: any) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_FOTO.includes(extension)) {
      return cb(
        new BadRequestException(
          `Formato no permitido (${extension || 'sin extensión'}). La foto debe ser PNG, JPG o WEBP.`,
        ),
        false,
      );
    }
    cb(null, true);
  },
};

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {
    // La carpeta debe existir antes de que llegue la primera subida.
    mkdirSync(AVATARES_DIR, { recursive: true });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser('sub') usuarioId: number) {
    return this.usuariosService.getPerfil(usuarioId);
  }

  @Post('me/foto')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('foto', FOTO_MULTER))
  subirFoto(@CurrentUser('sub') usuarioId: number, @UploadedFile() archivo: any) {
    if (!archivo) {
      throw new BadRequestException(
        'Adjunta una imagen en el campo «foto» (PNG, JPG o WEBP, hasta 2 MB)',
      );
    }
    return this.usuariosService.guardarFoto(usuarioId, archivo);
  }

  @Delete('me/foto')
  @UseGuards(JwtAuthGuard)
  quitarFoto(@CurrentUser('sub') usuarioId: number) {
    return this.usuariosService.quitarFoto(usuarioId);
  }
}
