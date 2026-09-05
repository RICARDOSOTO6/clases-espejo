import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpdateInstitucionDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  pais: string;

  @IsEmail()
  correoInstitucional: string;
}
