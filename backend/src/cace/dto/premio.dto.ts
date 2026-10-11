import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Premios y reconocimientos de la CACE.
 *
 * `publicado` es lo que separa el borrador del escaparate: un premio sin
 * publicar no sale nunca en la lectura pública (ni en la sección de Comunidad
 * ni en la portada del acceso), solo en el panel de la presidencia.
 *
 * `institucionId` es opcional porque hay reconocimientos a personas, a un país
 * o a la propia CACE, sin institución detrás.
 */
export class CrearPremioDto {
  @IsString()
  @MinLength(3, { message: 'El título es obligatorio' })
  @MaxLength(160, { message: 'El título no puede pasar de 160 caracteres' })
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500, {
    message: 'La descripción no puede pasar de 1500 caracteres',
  })
  descripcion?: string;

  @IsInt({ message: 'El año es obligatorio' })
  @Min(1900, { message: 'El año no parece válido' })
  @Max(2100, { message: 'El año no parece válido' })
  anio: number;

  @IsString()
  @MinLength(2, { message: 'Indica a quién se le otorgó' })
  @MaxLength(200, {
    message: '«Otorgado a» no puede pasar de 200 caracteres',
  })
  otorgadoA: string;

  /** `null` borra la institución; sin el campo, no se toca. */
  @IsOptional()
  @IsInt()
  institucionId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}

/** Edición de un premio: los mismos campos, todos opcionales. */
export class ActualizarPremioDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El título es obligatorio' })
  @MaxLength(160, { message: 'El título no puede pasar de 160 caracteres' })
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500, {
    message: 'La descripción no puede pasar de 1500 caracteres',
  })
  descripcion?: string;

  @IsOptional()
  @IsInt({ message: 'El año debe ser un número' })
  @Min(1900, { message: 'El año no parece válido' })
  @Max(2100, { message: 'El año no parece válido' })
  anio?: number;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Indica a quién se le otorgó' })
  @MaxLength(200, {
    message: '«Otorgado a» no puede pasar de 200 caracteres',
  })
  otorgadoA?: string;

  /** `null` borra la institución; sin el campo, no se toca. */
  @IsOptional()
  @IsInt()
  institucionId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}
