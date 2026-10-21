import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { EsTextoValido } from '../../common/validators/es-texto-valido';
import { PASSWORD_MINIMO } from '../../common/politica-password';
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
  @MinLength(PASSWORD_MINIMO, {
    message: `La contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres`,
  })
  password!: string;
}
