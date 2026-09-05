import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ActivateAccountDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  nombres: string;

  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @IsString()
  @IsNotEmpty()
  apellidoMaterno: string;

  @IsString()
  @IsNotEmpty()
  dni: string;

  @IsString()
  @IsNotEmpty()
  gradoAcademico: string;

  @IsString()
  @IsNotEmpty()
  especialidad: string;

  @IsString()
  @MinLength(6)
  password: string;
}
