import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { EsTextoValido } from '../../common/validators/es-texto-valido';

export class ActivateAccountDto {
  @IsString()
  @IsNotEmpty()
  token: string;

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

  @IsString()
  @IsNotEmpty()
  gradoAcademico: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  especialidad: string;

  @IsString()
  @MinLength(6)
  password: string;
}
