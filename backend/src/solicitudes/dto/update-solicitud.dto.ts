import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateSolicitudDto {
  @IsInt()
  @IsOptional()
  asignacionOrigenId?: number;

  @IsInt()
  @IsOptional()
  institucionDestinoId?: number;

  @IsInt()
  @IsOptional()
  materiaDestinoId?: number | null;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  titulo?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  objetivo?: string;

  @IsDateString()
  @IsOptional()
  fechaPropuesta?: string;
}
