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
  correo!: string;

  @IsString()
  @MinLength(2, { message: 'El nombre es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  nombres!: string;

  @IsString()
  @MinLength(2, { message: 'El apellido paterno es obligatorio' })
  @MaxLength(80, { message: 'El apellido no puede pasar de 80 caracteres' })
  apellidoPaterno!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'El apellido no puede pasar de 80 caracteres' })
  apellidoMaterno?: string;
}

/**
 * Activar o desactivar a un miembro de la CACE.
 *
 * Solo vale para las **secretarías**: la presidencia y la suplencia no se
 * desactivan (son una figura central) y el servicio lo rechaza con un mensaje
 * que remite a «Cambiar de presidente». Desactivar una secretaría no borra la
 * fila: apaga su acceso (el guardia ignora las membresías inactivas).
 */
export class ActualizarMiembroCaceDto {
  @IsBoolean()
  activo!: boolean;
}
