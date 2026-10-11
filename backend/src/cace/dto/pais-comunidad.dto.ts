import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Países de la comunidad CACE. Antes eran una lista fija en el frontend y ahora
 * los mantiene la presidencia.
 *
 * El código es ISO 3166-1 alpha-2 y se guarda en mayúsculas: es lo que arma la
 * bandera (`https://flagcdn.com/w40/<codigo>.png`), así que un código con otro
 * formato daría una bandera rota sin que nadie se entere.
 */
export class CrearPaisComunidadDto {
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, {
    message: 'El código debe ser ISO de dos letras (por ejemplo MX)',
  })
  codigo: string;

  @IsString()
  @MinLength(2, { message: 'El nombre del país es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  nombre: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** Edición de un país: se puede cambiar cualquier campo, incluido el código. */
export class ActualizarPaisComunidadDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, {
    message: 'El código debe ser ISO de dos letras (por ejemplo MX)',
  })
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre del país es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
