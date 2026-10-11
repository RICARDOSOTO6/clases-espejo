import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TEMAS_CACE } from '../../common/temas-cace';

/**
 * Edición de la identidad de la CACE (lema, descripción y tema).
 *
 * Todo es opcional porque es un `PATCH`: se manda solo lo que cambia. El tema
 * **no** es color libre, sino una de las claves de `TEMAS_CACE`; con
 * `@IsIn` una petición con un tema inventado se rechaza antes de llegar a la
 * base, que es donde se rompería el contraste.
 *
 * El logo no viaja aquí: tiene sus propias rutas porque es un archivo.
 */
export class ActualizarConfiguracionCaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'El lema no puede pasar de 160 caracteres' })
  lema?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600, {
    message: 'La descripción no puede pasar de 600 caracteres',
  })
  descripcion?: string;

  @IsOptional()
  @IsIn([...TEMAS_CACE], {
    message: `El tema debe ser uno de: ${TEMAS_CACE.join(', ')}`,
  })
  tema?: string;
}
