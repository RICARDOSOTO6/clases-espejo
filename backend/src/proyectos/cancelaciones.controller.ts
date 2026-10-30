import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ParticipantesService } from './participantes.service';
import { MotivoSalidaDto } from './dto/motivo-salida.dto';
import { SolicitarCancelacionDto } from './dto/solicitar-cancelacion.dto';
import { VotarCancelacionDto } from './dto/votar-cancelacion.dto';

@Controller('proyectos/:id')
@UseGuards(JwtAuthGuard)
export class CancelacionesController {
  constructor(private readonly participantes: ParticipantesService) {}

  @Get('cancelacion')
  estado(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.participantes.estadoCancelacion(usuarioId, id);
  }

  @Post('salir')
  salir(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MotivoSalidaDto,
  ) {
    return this.participantes.salir(usuarioId, id, dto.motivo);
  }

  @Post('cancelacion')
  solicitar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SolicitarCancelacionDto,
  ) {
    return this.participantes.solicitarCancelacion(usuarioId, id, dto.motivo);
  }

  @Post('cancelacion/votos')
  votar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VotarCancelacionDto,
  ) {
    return this.participantes.votarCancelacion(
      usuarioId,
      id,
      dto.decision,
      dto.motivo ?? '',
    );
  }
}
