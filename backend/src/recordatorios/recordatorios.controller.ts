import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RecordatoriosService } from './recordatorios.service';

/**
 * Agenda del usuario: qué vence pronto (solicitudes y clases), qué falta por
 * hacer y cuántas solicitudes caducaron por falta de respuesta.
 */
@Controller('recordatorios')
@UseGuards(JwtAuthGuard)
export class RecordatoriosController {
  constructor(private readonly recordatoriosService: RecordatoriosService) {}

  @Get()
  obtener(@CurrentUser('sub') usuarioId: number) {
    return this.recordatoriosService.obtener(usuarioId);
  }
}
