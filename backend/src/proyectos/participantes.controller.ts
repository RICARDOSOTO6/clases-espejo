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
import { AgregarParticipanteDto } from './dto/agregar-participante.dto';
import { DecidirParticipanteDto } from './dto/decidir-participante.dto';
import { AgregarObservadorDto } from './dto/agregar-observador.dto';

@Controller('proyectos/:id')
@UseGuards(JwtAuthGuard)
export class ParticipantesController {
  constructor(private readonly participantes: ParticipantesService) {}

  @Get('participantes')
  listar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.participantes.listar(usuarioId, id);
  }

  @Post('participantes')
  agregar(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AgregarParticipanteDto,
  ) {
    return this.participantes.agregar(usuarioId, id, dto.institucionId);
  }

  @Post('participantes/:participanteId/decidir')
  decidir(
    @CurrentUser('sub') usuarioId: number,
    @Param('participanteId', ParseIntPipe) participanteId: number,
    @Body() dto: DecidirParticipanteDto,
  ) {
    return this.participantes.decidir(usuarioId, participanteId, dto);
  }

  @Post('observadores')
  observador(
    @CurrentUser('sub') usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AgregarObservadorDto,
  ) {
    return this.participantes.agregarObservador(
      usuarioId,
      id,
      dto.institucionId,
    );
  }
}
