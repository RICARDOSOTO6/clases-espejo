import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ESTADOS_PLANIFICACION } from '../../common/estados';

export class SavePlanificacionDto {
  @IsString()
  @IsNotEmpty()
  objetivosAcordados: string;

  @IsString()
  @IsNotEmpty()
  temasAcordados: string;

  @IsString()
  @IsNotEmpty()
  metodologia: string;

  @IsString()
  @IsNotEmpty()
  plataforma: string;

  @IsString()
  @IsIn(ESTADOS_PLANIFICACION)
  @IsOptional()
  estado?: string;
}
