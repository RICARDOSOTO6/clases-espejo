import { Equals, IsEmail, IsString, MinLength } from 'class-validator';
import { DatosPersonaDto } from '../../auth/dto/datos-persona.dto';
import { PASSWORD_MINIMO } from '../../common/politica-password';

/** Activación del enlace de secretaría. El correo se pide aquí, no al invitar. */
export class ActivarSecretariaDto extends DatosPersonaDto {
  @IsString()
  token!: string;

  @IsEmail()
  correo!: string;

  @IsString()
  @MinLength(PASSWORD_MINIMO, {
    message: `La contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres`,
  })
  password!: string;

  @Equals(true, {
    message: 'Debes aceptar el aviso de privacidad y los términos',
  })
  aceptaAviso!: boolean;
}
