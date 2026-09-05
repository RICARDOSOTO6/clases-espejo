import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
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

  @IsEmail()
  correo: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  nombreInstitucion: string;

  @IsString()
  @IsNotEmpty()
  pais: string;

  @IsEmail()
  correoInstitucional: string;

  @IsString()
  @IsNotEmpty()
  cargo: string;
}
