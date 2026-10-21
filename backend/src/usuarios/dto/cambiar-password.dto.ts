import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { PASSWORD_MINIMO } from '../../common/politica-password';

/**
 * Cambio de contraseña del propio usuario. Desde la Fase 1 la nueva debe
 * cumplir la política: mínimo 10 caracteres y distinta del correo (esa segunda
 * comprobación la hace el servicio, que conoce el correo de la cuenta).
 */
export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty()
  actual!: string;

  @IsString()
  @MinLength(PASSWORD_MINIMO, {
    message: `La nueva contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres`,
  })
  nueva!: string;
}
