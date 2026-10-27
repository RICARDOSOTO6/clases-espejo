import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { DesempenoService } from '../desempeno/desempeno.service';

/**
 * Panel de desempeño de las instituciones. Solo la presidencia: la secretaría
 * de la CACE no necesita ver la comparación entre universidades para hacer su
 * trabajo.
 */
@Controller('cace/desempeno')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
export class DesempenoCaceController {
  constructor(private readonly desempeno: DesempenoService) {}

  @Get()
  @Requiere('aprobarInstituciones')
  listar() {
    return this.desempeno.paraCace();
  }
}
