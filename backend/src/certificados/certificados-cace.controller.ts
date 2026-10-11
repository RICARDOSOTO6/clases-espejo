import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CertificadosService } from './certificados.service';
import { AnularCertificadoDto } from './dto/anular-certificado.dto';

/**
 * Anulación de certificados desde el panel de la **presidencia**.
 *
 * Vive aparte del controlador de la clase espejo (`/proyectos/:id/certificados`)
 * porque la presidencia no está dentro de un proyecto: no tiene un `proyectoId`
 * con el que acotar la petición ni una lista de alumnos que sea «suya». Aquí se
 * anula por el identificador del certificado y la capacidad
 * `anularCertificados` (que comparten presidencia y docentes) decide quién
 * entra; el servicio vuelve a comprobar que quien llama sea miembro activo de la
 * CACE.
 *
 * El prefijo cuelga de `/cace/certificados`, donde ya vive la plantilla, para que
 * todo lo de certificados del panel esté junto.
 */
@Controller('cace/certificados')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
export class CertificadosCaceController {
  constructor(private readonly certificados: CertificadosService) {}

  /** Anula un certificado con su motivo. El motivo es obligatorio. */
  @Post(':certificadoId/anular')
  @Requiere('anularCertificados')
  anular(
    @CurrentUser('sub') usuarioId: number,
    @Param('certificadoId', ParseIntPipe) certificadoId: number,
    @Body() dto: AnularCertificadoDto,
  ) {
    return this.certificados.anular({
      usuarioId,
      certificadoId,
      motivo: dto.motivo,
    });
  }
}
