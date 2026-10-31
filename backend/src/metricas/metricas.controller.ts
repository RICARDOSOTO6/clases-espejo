import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CapacidadesGuard, Requiere } from '../auth/capacidades.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetricasService } from './metricas.service';

@Controller('metricas')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  /**
   * Rendimiento real acumulado desde que arrancó el proceso.
   * No hay peticiones sintéticas: refleja el tráfico del piloto.
   */
  @Get('rendimiento')
  @Requiere('verRendimientoPiloto')
  rendimiento() {
    return this.metricas.snapshot();
  }

  /** Misma información por ruta, en CSV para el informe o una hoja de cálculo. */
  @Get('rendimiento.csv')
  @Requiere('verRendimientoPiloto')
  rendimientoCsv(@Res() res: Response): void {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="rendimiento-piloto.csv"',
    );
    res.send(this.metricas.csv());
  }
}
