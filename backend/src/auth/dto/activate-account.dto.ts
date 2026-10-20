import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { EsTextoValido } from '../../common/validators/es-texto-valido';
import { DatosPersonaDto } from './datos-persona.dto';

export class ActivateAccountDto extends DatosPersonaDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  gradoAcademico!: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  especialidad!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
