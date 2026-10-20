import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Países de la comunidad CACE. Antes eran una lista fija en el frontend y ahora
 * los mantiene la presidencia.
 *
 * El código es ISO 3166-1 alpha-2 y se guarda en mayúsculas: es lo que arma la
 * bandera (`https://flagcdn.com/w40/<codigo>.png`), así que un código con otro
 * formato daría una bandera rota sin que nadie se entere.
 *
 * **No hay campo de orden a propósito.** La lista se muestra siempre en orden
 * alfabético por nombre (sin distinguir mayúsculas ni acentos), así que un
 * número manual solo servía para descolocar la lista: el panel y
 * `GET /cace/publico` ordenan igual, y la columna `orden` del esquema queda
 * con su valor por defecto sin que nadie la escriba.
 */
export class CrearPaisComunidadDto {
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, {
    message: 'El código debe ser ISO de dos letras (por ejemplo MX)',
  })
  codigo!: string;

  @IsString()
  @MinLength(2, { message: 'El nombre del país es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  nombre!: string;

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
  @IsBoolean()
  activo?: boolean;
}
