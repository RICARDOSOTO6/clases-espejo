import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const ESTADOS_PLANIFICACION = ['BORRADOR', 'EN_REVISION', 'APROBADA'];

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
