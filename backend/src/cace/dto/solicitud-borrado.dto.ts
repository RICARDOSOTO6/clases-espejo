import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Petición de la secretaría para borrar definitivamente una institución
 * rechazada. El motivo es obligatorio: el presidente decide sobre él y queda
 * escrito en la solicitud.
 */
export class SolicitarBorradoInstitucionDto {
  @IsString()
  @IsNotEmpty({
    message: 'Indica el motivo por el que hay que borrar la institución',
  })
  @MaxLength(1000, { message: 'El motivo no puede pasar de 1000 caracteres' })
  motivo!: string;
}

/**
 * Respuesta del presidente a una solicitud de borrado.
 *
 * `motivo` solo hace falta al rechazar (para que la secretaría sepa por qué);
 * al aprobar, el motivo es el que ya traía la solicitud.
 */
export class ResolverSolicitudBorradoDto {
  @IsBoolean({ message: 'Indica si apruebas o rechazas la solicitud' })
  aprobar!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'El motivo no puede pasar de 1000 caracteres' })
  motivo?: string;
}
