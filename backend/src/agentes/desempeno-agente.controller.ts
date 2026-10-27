import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DesempenoService } from '../desempeno/desempeno.service';

/** Desempeño de los docentes de la institución del agente autenticado. */
@Controller('agentes')
@UseGuards(JwtAuthGuard)
export class DesempenoAgenteController {
  constructor(private readonly desempeno: DesempenoService) {}

  @Get('desempeno')
  listar(@CurrentUser('sub') usuarioId: number) {
    return this.desempeno.paraAgente(usuarioId);
  }
}
