import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateSesionDto {
  @IsString()
  @IsOptional()
  titulo?: string;

  @IsDateString()
  @IsOptional()
  fechaHora?: string;

  @IsString()
  @IsOptional()
  enlaceVirtual?: string;

  @IsString()
  @IsOptional()
  estado?: string;
}
