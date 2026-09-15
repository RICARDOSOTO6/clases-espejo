import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateActividadDto {
  @IsString()
  @IsOptional()
  titulo?: string;

  @IsString()
  @IsOptional()
  instrucciones?: string;

  @IsDateString()
  @IsOptional()
  fechaLimite?: string;
}
