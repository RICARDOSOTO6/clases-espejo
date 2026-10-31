import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
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

  /**
   * Histórico real del piloto. Si existe METRICAS_ARCHIVO, agrega todo el
   * archivo JSONL; si no, devuelve la instancia actual y lo indica en
   * `X-Metricas-Alcance`.
   */
  @Get('rendimiento/historico.csv')
  @Requiere('verRendimientoPiloto')
  async rendimientoHistoricoCsv(@Res() res: Response): Promise<void> {
    const resultado = await this.metricas.historicoCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('X-Metricas-Alcance', resultado.alcance);
    if (resultado.desde) res.setHeader('X-Metricas-Desde', resultado.desde);
    if (resultado.hasta) res.setHeader('X-Metricas-Hasta', resultado.hasta);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="rendimiento-historico-piloto.csv"',
    );
    res.send(resultado.csv);
  }

  /**
   * Deja los contadores a cero sin reiniciar el proceso.
   *
   * Uso en el piloto: se hacen unas cuantas peticiones de calentamiento y se
   * llama aquí justo antes de empezar, para que las cifras publicadas no
   * incluyan el arranque de Node ni la primera consulta de Prisma.
   */
  @Post('reiniciar')
  @Requiere('verRendimientoPiloto')
  reiniciar(): { reiniciado: boolean; desde: string } {
    this.metricas.reiniciar();
    return { reiniciado: true, desde: new Date().toISOString() };
  }
}
