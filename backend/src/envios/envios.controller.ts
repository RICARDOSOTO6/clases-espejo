import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EnviosCorreoService } from './envios.service';

@Controller('envios')
@UseGuards(JwtAuthGuard)
export class EnviosController {
  constructor(private readonly envios: EnviosCorreoService) {}

  /**
   * Progreso de un lote de correos. El lote se identifica con el `loteId` que
   * devuelven los endpoints de envío; solo lo puede consultar quien lo pidió.
   */
  @Get('lotes/:loteId')
  progreso(
    @CurrentUser('sub') usuarioId: number,
    @Param('loteId') loteId: string,
  ) {
    return this.envios.progreso(loteId, usuarioId);
  }
}
