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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import {
  IMAGENES_PREMIO_DIR,
  LOGOS_CACE_DIR,
  IdentidadCaceService,
} from './identidad-cace.service';
import { ActualizarConfiguracionCaceDto } from './dto/configuracion-cace.dto';
import {
  ActualizarPaisComunidadDto,
  CrearPaisComunidadDto,
} from './dto/pais-comunidad.dto';
import { ActualizarPremioDto, CrearPremioDto } from './dto/premio.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { opcionesImagen } from '../common/imagenes';

/**
 * Gestión de la identidad de la CACE desde el panel de la presidencia.
 *
 * Cada ruta pide su capacidad en el método en lugar de en la clase, porque aquí
 * conviven dos permisos distintos: `personalizarCace` (textos, logo, tema y
 * banderas) y `publicarPremios` (premios). Ponerlos en la clase obligaría a
 * repetir el guardia y a acordarse de cuál toca en cada ruta nueva; así se lee
 * de un vistazo qué exige cada una.
 */
@Controller('cace')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
export class IdentidadCaceController {
  constructor(private readonly identidad: IdentidadCaceService) {
    // Las carpetas deben existir antes de la primera subida (el guardado con
    // multer no las crea).
    mkdirSync(LOGOS_CACE_DIR, { recursive: true });
    mkdirSync(IMAGENES_PREMIO_DIR, { recursive: true });
  }

  // --- Configuración: lema, descripción y tema ---

  @Get('configuracion')
  @Requiere('personalizarCace')
  obtenerConfiguracion() {
    return this.identidad.obtenerConfiguracion();
  }

  @Patch('configuracion')
  @Requiere('personalizarCace')
  actualizarConfiguracion(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: ActualizarConfiguracionCaceDto,
  ) {
    return this.identidad.actualizarConfiguracion(usuarioId, dto);
  }

  /**
   * Logo de la CACE. Se guarda en `uploads/cace` y se sirve **en línea** por
   * `/cace-logo/<archivo>` (no por `/uploads`, donde todo sale como descarga):
   * es una imagen que se pinta con `<img>`.
   */
  @Post('configuracion/logo')
  @Requiere('personalizarCace')
  @UseInterceptors(
    FileInterceptor('logo', opcionesImagen(LOGOS_CACE_DIR, 'cace-logo')),
  )
  subirLogo(
    @CurrentUser('sub') usuarioId: number,
    @UploadedFile() archivo: any,
  ) {
    if (!archivo) {
      throw new BadRequestException(
        'Adjunta una imagen en el campo «logo» (PNG, JPG o WEBP, hasta 2 MB)',
      );
    }
    return this.identidad.guardarLogo(usuarioId, archivo);
  }

  @Delete('configuracion/logo')
  @Requiere('personalizarCace')
  quitarLogo(@CurrentUser('sub') usuarioId: number) {
    return this.identidad.quitarLogo(usuarioId);
  }

  // --- Banderas de la comunidad ---

  /** Todos los países (con los inactivos), que es lo que necesita el panel. */
  @Get('paises')
  @Requiere('personalizarCace')
  listarPaises() {
    return this.identidad.listarPaises();
  }

  @Post('paises')
  @Requiere('personalizarCace')
  crearPais(@Body() dto: CrearPaisComunidadDto) {
    return this.identidad.crearPais(dto);
  }

  @Patch('paises/:id')
  @Requiere('personalizarCace')
  actualizarPais(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPaisComunidadDto,
  ) {
    return this.identidad.actualizarPais(id, dto);
  }

  @Delete('paises/:id')
  @Requiere('personalizarCace')
  eliminarPais(@Param('id', ParseIntPipe) id: number) {
    return this.identidad.eliminarPais(id);
  }

  // --- Premios y reconocimientos ---

  /** Todos los premios (publicados y no) y las instituciones del formulario. */
  @Get('premios')
  @Requiere('publicarPremios')
  listarPremios() {
    return this.identidad.listarPremios();
  }

  @Post('premios')
  @Requiere('publicarPremios')
  crearPremio(@Body() dto: CrearPremioDto) {
    return this.identidad.crearPremio(dto);
  }

  @Patch('premios/:id')
  @Requiere('publicarPremios')
  actualizarPremio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPremioDto,
  ) {
    return this.identidad.actualizarPremio(id, dto);
  }

  @Delete('premios/:id')
  @Requiere('publicarPremios')
  eliminarPremio(@Param('id', ParseIntPipe) id: number) {
    return this.identidad.eliminarPremio(id);
  }

  @Post('premios/:id/imagen')
  @Requiere('publicarPremios')
  @UseInterceptors(
    FileInterceptor('imagen', opcionesImagen(IMAGENES_PREMIO_DIR, 'premio')),
  )
  subirImagenPremio(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: any,
  ) {
    if (!archivo) {
      throw new BadRequestException(
        'Adjunta una imagen en el campo «imagen» (PNG, JPG o WEBP, hasta 2 MB)',
      );
    }
    return this.identidad.guardarImagenPremio(id, archivo);
  }

  @Delete('premios/:id/imagen')
  @Requiere('publicarPremios')
  quitarImagenPremio(@Param('id', ParseIntPipe) id: number) {
    return this.identidad.quitarImagenPremio(id);
  }
}
