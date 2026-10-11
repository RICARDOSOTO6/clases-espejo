import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Alta de una secretaría de la CACE.
 *
 * Solo se piden el correo y el nombre: la cuenta nace con contraseña
 * provisional y el cargo lo pone el servidor (`SECRETARIA`), porque este panel
 * no reparte presidencias. Si la persona **ya es usuaria** de la plataforma, no
 * se duplica nada: se le añade la fila de miembro.
 */
export class CrearMiembroCaceDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  correo: string;

  @IsString()
  @MinLength(2, { message: 'El nombre es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  nombres: string;

  @IsString()
  @MinLength(2, { message: 'El apellido paterno es obligatorio' })
  @MaxLength(80, { message: 'El apellido no puede pasar de 80 caracteres' })
  apellidoPaterno: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'El apellido no puede pasar de 80 caracteres' })
  apellidoMaterno?: string;
}

/**
 * Activar o desactivar a un miembro de la CACE. Desactivar no borra la fila:
 * apaga el acceso (el guardia ignora las membresías inactivas), que es lo que
 * hace falta cuando alguien deja el cargo.
 */
export class ActualizarMiembroCaceDto {
  @IsBoolean()
  activo: boolean;
}
