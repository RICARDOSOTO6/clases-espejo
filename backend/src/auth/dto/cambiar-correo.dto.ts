import { IsEmail, IsNotEmpty } from 'class-validator';

/** Petición de cambio de correo: se confirma desde la dirección nueva. */
export class CambiarCorreoDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @IsNotEmpty()
  correo!: string;
}
