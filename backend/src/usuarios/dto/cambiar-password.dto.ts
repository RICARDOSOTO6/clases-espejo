import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Cambio de contraseña del propio usuario. El mínimo de la nueva son 8
 * caracteres (más que los 6 de la invitación): la provisional que genera el
 * sistema dura un solo acceso, pero la definitiva es la que protege la cuenta.
 */
export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty()
  actual: string;

  @IsString()
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres',
  })
  nueva: string;
}
