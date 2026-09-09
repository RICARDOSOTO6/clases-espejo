import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { EsTextoValido } from '../../common/validators/es-texto-valido';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  nombres: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  apellidoPaterno: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  apellidoMaterno: string;

  @IsString()
  @IsNotEmpty()
  tipoDocumento: string;

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
  @EsTextoValido()
  nombreInstitucion: string;

  @IsString()
  @IsNotEmpty()
  pais: string;

  @IsString()
  @IsNotEmpty()
  codigoPais: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  estado: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  ciudad: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsEmail()
  correoInstitucional: string;

  @IsString()
  @IsNotEmpty()
  cargo: string;
}
