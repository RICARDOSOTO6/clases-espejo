import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Tope de la hoja, en píxeles de la plantilla. */
const MAXIMO_LADO = 6000;
const MINIMO_LADO = 200;

/**
 * Guardar la plantilla del certificado: **siempre crea una versión nueva**.
 *
 * No hay `PATCH` a propósito. Lo que llega se aplica encima de la versión
 * activa y el resultado es la versión siguiente; la anterior queda como estaba
 * porque hay certificados emitidos que apuntan a ella.
 *
 * `campos` y `textosLegales` se validan como objeto y lista, no campo a campo:
 * los detalles (que la posición sea un número, que el color tenga seis dígitos)
 * los comprueba y los corrige `normalizarCampos`, que es el mismo código que
 * lee después el generador del PDF. Así el panel no puede guardar nada que el
 * PDF no sepa dibujar, ni siquiera llamando a la API a mano.
 */
export class GuardarPlantillaDto {
  /** Posición y estilo de cada dato, por clave (`nombre`, `titulo`…). */
  @IsOptional()
  @IsObject()
  campos?: Record<string, unknown>;

  /** Párrafos legales sueltos, cada uno con su sitio. */
  @IsOptional()
  @IsArray()
  textosLegales?: Record<string, unknown>[];

  /** Quien firma. Por omisión, el nombre del presidente de la CACE. */
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'El nombre de la firma no puede pasar de 160 caracteres' })
  firmaNombre?: string;

  /** Tamaño de la imagen de fondo (solo cambia con un fondo nuevo). */
  @IsOptional()
  @IsInt()
  @Min(MINIMO_LADO, { message: 'El ancho de la plantilla no parece válido' })
  @Max(MAXIMO_LADO, { message: 'El ancho de la plantilla no parece válido' })
  anchoPx?: number;

  @IsOptional()
  @IsInt()
  @Min(MINIMO_LADO, { message: 'El alto de la plantilla no parece válido' })
  @Max(MAXIMO_LADO, { message: 'El alto de la plantilla no parece válido' })
  altoPx?: number;

  /** `null` o vacío quita el fondo; sin el campo, no se toca. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  fondoUrl?: string | null;
}
