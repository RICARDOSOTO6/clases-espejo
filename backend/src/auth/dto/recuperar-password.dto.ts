import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * Solicitud del enlace de recuperación.
 *
 * La respuesta es **siempre la misma** exista o no la cuenta: así no se puede
 * usar este formulario para averiguar qué correos están registrados.
 */
export class RecuperarPasswordDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @IsNotEmpty()
  correo!: string;
}
