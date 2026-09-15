import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSesionDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsDateString()
  fechaHora: string;

  @IsString()
  @IsNotEmpty()
  enlaceVirtual: string;

  @IsString()
  @IsOptional()
  estado?: string;
}
