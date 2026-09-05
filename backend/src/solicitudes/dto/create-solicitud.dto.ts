import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSolicitudDto {
  @IsInt()
  asignacionOrigenId: number;

  @IsInt()
  institucionDestinoId: number;

  @IsInt()
  @IsOptional()
  materiaDestinoId?: number | null;

  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  objetivo: string;

  @IsDateString()
  fechaPropuesta: string;
}
