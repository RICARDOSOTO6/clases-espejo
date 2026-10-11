import { Controller, Get } from '@nestjs/common';
import { IdentidadCaceService } from './identidad-cace.service';

/**
 * Identidad pública de la CACE.
 *
 * Va **sin guardia a propósito**: la pantalla de acceso necesita el lema, el
 * logo, el tema y las banderas *antes* de que nadie haya iniciado sesión. Por
 * eso mismo este controlador solo puede devolver lo que ya es público: nada de
 * premios sin publicar ni de países desactivados.
 *
 * El prefijo es `/cace`, así que la lectura pública queda en `/cace/publico`,
 * separada de las rutas de gestión (`/cace/configuracion`, `/cace/paises`…),
 * que sí piden sesión y capacidad.
 */
@Controller('cace')
export class IdentidadCacePublicaController {
  constructor(private readonly identidad: IdentidadCaceService) {}

  /** Textos, logo, tema y países activos de la comunidad. */
  @Get('publico')
  publico() {
    return this.identidad.configuracionPublica();
  }

  /** Premios y reconocimientos publicados, para la sección «Comunidad». */
  @Get('premios-publicos')
  premiosPublicos() {
    return this.identidad.listarPremiosPublicados();
  }
}
