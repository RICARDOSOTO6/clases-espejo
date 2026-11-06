import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EsTextoValido } from '../../common/validators/es-texto-valido';

export class UpdateInstitucionDto {
  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  pais!: string;

  @IsString()
  @IsNotEmpty()
  codigoPais!: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  estado!: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  ciudad!: string;

  @IsString()
  @IsNotEmpty()
  telefono!: string;

  /** Dirección física: es el dato de contacto institucional. */
  @IsOptional()
  @IsString()
  direccion?: string;

  /** Se conserva para instituciones antiguas que ya lo tenían. */
  @IsOptional()
  @IsEmail()
  correoInstitucional?: string;
}
