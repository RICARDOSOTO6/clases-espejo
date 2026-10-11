import {
  IsEmail,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Cambio de presidencia de la CACE.
 *
 * La presidencia **no se borra ni se desactiva**: se transmite. El sucesor se
 * elige de una de estas dos formas, y solo una:
 *
 * - `miembroId`: alguien que ya está dentro de la CACE (la secretaría o un
 *   suplente). No se duplica su cuenta: se le cambia el cargo.
 * - `correo` + nombre: una persona nueva (o alguien que ya es usuario de la
 *   plataforma), que entra con contraseña provisional y cambio obligatorio,
 *   igual que el alta de una secretaría.
 *
 * Mandar las dos cosas a la vez no vale: el servicio lo rechaza en vez de
 * adivinar cuál de las dos quería quien llama.
 */
export class CambiarPresidenteDto {
  /** Fila de `MIEMBRO_CACE` del sucesor, si ya está dentro de la CACE. */
  @IsOptional()
  @IsInt({ message: 'El miembro no es válido' })
  @IsPositive({ message: 'El miembro no es válido' })
  miembroId?: number;

  // --- Persona nueva: solo se piden cuando no se elige a un miembro ---

  @ValidateIf((dto: CambiarPresidenteDto) => dto.miembroId === undefined)
  @IsEmail({}, { message: 'Escribe un correo válido' })
  correo?: string;

  @ValidateIf((dto: CambiarPresidenteDto) => dto.miembroId === undefined)
  @IsString()
  @MinLength(2, { message: 'El nombre es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  nombres?: string;

  @ValidateIf((dto: CambiarPresidenteDto) => dto.miembroId === undefined)
  @IsString()
  @MinLength(2, { message: 'El apellido paterno es obligatorio' })
  @MaxLength(80, { message: 'El apellido no puede pasar de 80 caracteres' })
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'El apellido no puede pasar de 80 caracteres' })
  apellidoMaterno?: string;

  /**
   * Por qué se transmite el cargo. Es opcional, pero queda escrito en el
   * historial: es lo que permite entender el cambio meses después.
   */
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  motivo?: string;
}
