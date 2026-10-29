import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class DecidirParticipanteDto {
  @IsString()
  @IsIn(['APROBADA', 'RECHAZADA'])
  decision!: 'APROBADA' | 'RECHAZADA';

  @IsInt()
  @Min(1)
  @IsOptional()
  asignacionDocenteId?: number;

  @IsString()
  @IsOptional()
  motivo?: string;
}
