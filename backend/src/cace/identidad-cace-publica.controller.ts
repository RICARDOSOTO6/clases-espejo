import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IdentidadCaceService } from './identidad-cace.service';
import { cabeceraDescarga } from '../common/imagenes';

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

  /**
   * Se guarda y se revalida con el ETag (304 cuando no cambió): la portada no
   * repite el cuerpo en cada visita, pero nunca enseña una identidad vieja
   * después de que la presidencia cambie el lema o las banderas.
   */
  @Get('publico')
  @Header('Cache-Control', 'max-age=0, must-revalidate')
  publico() {
    return this.identidad.configuracionPublica();
  }

  /** Premios y reconocimientos publicados, para la sección «Comunidad». */
  @Get('premios-publicos')
  @Header('Cache-Control', 'max-age=0, must-revalidate')
  premiosPublicos() {
    return this.identidad.listarPremiosPublicados();
  }

  /**
   * El certificado de un premio publicado, con su nombre y su tipo.
   *
   * Va aquí y no en el controlador del panel porque un premio publicado lo
   * puede abrir cualquiera: es la pieza con la que se acredita el
   * reconocimiento. El servicio comprueba que el premio esté publicado y que el
   * archivo exista; lo que no está publicado responde 404 como si no existiera.
   *
   * Se entrega **como descarga** (`attachment`) y con el nombre original del
   * archivo, que es como se guarda un certificado. El tipo se lee del contenido
   * del archivo, no de su extensión, y se acompaña de `nosniff` y de una
   * política que impide que el documento cargue nada.
   */
  @Get('premios/certificado/:archivo')
  async certificado(
    @Param('archivo') archivo: string,
    @Res() res: Response,
  ): Promise<void> {
    const { nombre, tipo, buffer } =
      await this.identidad.certificadoDescargable(archivo);

    res.setHeader('Content-Type', tipo);
    res.setHeader('Content-Disposition', cabeceraDescarga(nombre));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.send(buffer);
  }
}
