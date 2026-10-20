import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { VerificacionService } from './verificacion.service';

/**
 * La página pública de verificación, que es lo que abre el QR del certificado.
 *
 * `GET /verificar/:folio?c=<codigo>`, **sin guardia a propósito**: la abre
 * cualquiera que escanee un certificado, sin cuenta y sin sesión.
 *
 * Tres cosas que se hacen así y conviene no «arreglar»:
 *
 * 1. **Siempre responde 200** con un estado (`VALIDO`, `ANULADO`,
 *    `NO_ENCONTRADO`, `INVALIDO`). Así la pantalla puede explicar qué pasa sin
 *    depender de un código de error, y no se puede distinguir un folio que no
 *    existe de uno al que le falta el código.
 * 2. **No hay ruta que liste.** Se pregunta por un folio concreto; no hay
 *    «dame todos» ni paginación, así que no se puede recorrer el registro de
 *    certificados.
 * 3. **`no-store`**: la respuesta no se cachea en el navegador ni en un proxy
 *    intermedio; el estado de un certificado puede cambiar (se anula) y la
 *    página tiene que decir siempre la verdad de hoy.
 */
@Controller('verificar')
export class VerificacionController {
  constructor(private readonly verificacion: VerificacionService) {}

  /** El estado de un certificado, con el código que va dentro del QR. */
  @Get(':folio')
  @Header('Cache-Control', 'no-store')
  verificar(@Param('folio') folio: string, @Query('c') codigo?: string) {
    return this.verificacion.verificar(folio, codigo);
  }
}
