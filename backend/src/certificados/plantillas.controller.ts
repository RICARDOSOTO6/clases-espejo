import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { mkdirSync } from 'fs';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { opcionesImagen } from '../common/imagenes';
import { GuardarPlantillaDto } from './dto/plantilla-certificado.dto';
import { PlantillasService } from './plantillas.service';
import { FONDOS_CERTIFICADO_DIR } from './rutas-certificado';

/**
 * La plantilla del certificado, que la diseña la presidencia.
 *
 * Todas las rutas piden `disenarCertificados`, que solo tiene el presidente
 * (ni la secretaría, ni el agente, ni el docente): el agente y el docente
 * reciben un 403, que es exactamente lo que dice la matriz de capacidades.
 *
 * El prefijo cuelga de `/cace` porque esto es una sección más del panel; la
 * emisión, en cambio, vive bajo `/proyectos/:id/certificados` porque la hace el
 * docente desde la clase espejo.
 */
@Controller('cace/certificados/plantilla')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
export class PlantillasCertificadoController {
  constructor(private readonly plantillas: PlantillasService) {
    // La carpeta de los diseños tiene que existir antes de la primera subida
    // (el guardado con multer no la crea).
    mkdirSync(FONDOS_CERTIFICADO_DIR, { recursive: true });
  }

  /** Catálogo de datos y todas las versiones. */
  @Get()
  @Requiere('disenarCertificados')
  listar() {
    return this.plantillas.listar();
  }

  /**
   * El QR de un folio, en PNG, para la vista previa del panel. Va detrás del
   * mismo permiso que el resto y se pide con sesión: la imagen de un QR no es
   * un secreto, pero tampoco hay razón para dejarla en una URL abierta.
   */
  @Get('qr')
  @Requiere('disenarCertificados')
  async qr(@Query('folio') folio: string, @Res() res: Response) {
    const png = await this.plantillas.qrDeMuestra(folio ?? '');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
  }

  /**
   * Guarda la plantilla **como versión nueva** (nunca edita la activa) y la
   * deja activa. Es el guardado del formulario del panel.
   */
  @Post()
  @Requiere('disenarCertificados')
  crear(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: GuardarPlantillaDto,
  ) {
    return this.plantillas.crear(usuarioId, dto);
  }

  /**
   * Sube la imagen del diseño. Se guarda en `uploads/certificados-fondos` y se
   * sirve **en línea** por `/certificado-fondo/<archivo>` para poder pintarla
   * con `<img>` en la vista previa. Mismo criterio que los logos: PNG, JPG o
   * WEBP y nunca SVG (un SVG puede llevar código dentro).
   *
   * También crea una versión nueva: si el diseño cambiara en la versión activa,
   * dos certificados de la misma versión tendrían diseños distintos.
   */
  @Post('fondo')
  @Requiere('disenarCertificados')
  @UseInterceptors(
    FileInterceptor(
      'fondo',
      opcionesImagen(FONDOS_CERTIFICADO_DIR, 'certificado-fondo'),
    ),
  )
  subirFondo(
    @CurrentUser('sub') usuarioId: number,
    @UploadedFile() archivo: any,
  ) {
    if (!archivo) {
      throw new BadRequestException(
        'Adjunta una imagen en el campo «fondo» (PNG, JPG o WEBP, hasta 2 MB)',
      );
    }
    return this.plantillas.guardarFondo(usuarioId, archivo);
  }

  /** Vuelve a poner como activa una versión anterior. */
  @Patch(':id/activar')
  @Requiere('disenarCertificados')
  activar(@Param('id', ParseIntPipe) id: number) {
    return this.plantillas.activar(id);
  }
}
