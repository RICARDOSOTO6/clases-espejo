import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { EsTextoValido } from '../../common/validators/es-texto-valido';

export class UpdateInstitucionDto {
  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  nombre: string;

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
}
