import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CertificadosService } from './certificados.service';
import { EmitirCertificadosDto } from './dto/emitir-certificados.dto';

/**
 * Emisión de los certificados de una clase espejo.
 *
 * Todo pide `emitirCertificados`, que en la matriz solo tiene el **docente**:
 * el agente y la presidencia reciben un 403 (la presidencia diseña y firma la
 * plantilla, pero no emite; el agente acompaña).
 *
 * Las descargas van por aquí y **no** como archivos estáticos: un certificado
 * lleva el nombre de una persona y no puede quedar en una URL pública que
 * cualquiera adivine. El servicio comprueba además que cada PDF es de la lista
 * de la institución de quien lo pide.
 */
@Controller('proyectos/:id/certificados')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
export class CertificadosController {
  constructor(private readonly certificados: CertificadosService) {}

  /** El estado de la sección: si se puede emitir, qué falta y qué hay emitido. */
  @Get()
  @Requiere('emitirCertificados')
  listar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.certificados.listar(usuarioId, id);
  }

  /** Emite uno (con `alumnoId`) o todos los alumnos incluidos de mi lista. */
  @Post('emitir')
  @Requiere('emitirCertificados')
  emitir(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EmitirCertificadosDto,
  ) {
    return this.certificados.emitir(usuarioId, id, dto);
  }

  /** Todos los certificados vigentes de mi lista, en un ZIP. */
  @Get('zip')
  @Requiere('emitirCertificados')
  async descargarZip(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { nombre, buffer } = await this.certificados.zip(usuarioId, id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  }

  /** El PDF de un certificado concreto. */
  @Get(':certificadoId/pdf')
  @Requiere('emitirCertificados')
  async descargarPdf(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('certificadoId', ParseIntPipe) certificadoId: number,
    @Res() res: Response,
  ) {
    const { nombre, buffer } = await this.certificados.descargar(
      usuarioId,
      id,
      certificadoId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  }
}
