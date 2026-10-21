import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { PASSWORD_MINIMO } from '../../common/politica-password';

/**
 * Restablecimiento con el token que llega por correo.
 *
 * El mínimo de 10 caracteres se comprueba también en el servicio (el DTO no
 * conoce el correo de la cuenta, y la política exige que la contraseña sea
 * distinta de él).
 */
export class RestablecerPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Falta el enlace de recuperación' })
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MINIMO, {
    message: `La contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres`,
  })
  password!: string;
}
