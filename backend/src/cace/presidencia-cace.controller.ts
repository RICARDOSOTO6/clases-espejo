import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PresidenciaCaceService } from './presidencia-cace.service';
import { CambiarPresidenteDto } from './dto/cambiar-presidente.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';

/**
 * La presidencia de la CACE: se **transmite**, no se borra ni se desactiva.
 *
 * Las dos rutas piden `gestionarMiembrosCace`, que **solo** tiene la presidencia
 * (ni la secretaría, ni el agente, ni el docente): repartir los cargos de la CACE
 * es suyo y de nadie más. Quien intenta cambiar la presidencia sin esa capacidad
 * recibe un 403 antes de llegar aquí.
 *
 * `cambiar` deja constancia del cambio en el historial y avisa por correo a los
 * dos: quien entra y quien sale (que sigue dentro como suplente).
 */
@Controller('cace/presidencia')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
@Requiere('gestionarMiembrosCace')
export class PresidenciaCaceController {
  constructor(private readonly presidencia: PresidenciaCaceService) {}

  /**
   * Transmite la presidencia. El sucesor se elige con `{ miembroId }` (alguien
   * que ya está en la CACE: la secretaría o un suplente) o con
   * `{ correo, nombres, apellidoPaterno, apellidoMaterno? }` (una persona nueva,
   * que entra con contraseña provisional y cambio obligatorio).
   */
  @Post('cambiar')
  cambiar(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: CambiarPresidenteDto,
  ) {
    return this.presidencia.cambiar(usuarioId, dto);
  }

  /** El historial de los cambios, con quién preside ahora. */
  @Get('historial')
  historial() {
    return this.presidencia.historial();
  }
}
