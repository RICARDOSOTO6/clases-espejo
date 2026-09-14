import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const ESTADOS_PROYECTO = [
  'EN_PLANIFICACION',
  'EN_CURSO',
  'FINALIZADO',
  'CANCELADO',
];

export class UpdateProyectoDto {
  @IsString()
  @IsIn(ESTADOS_PROYECTO)
  @IsOptional()
  estado?: string;

  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  plataforma?: string;
}
