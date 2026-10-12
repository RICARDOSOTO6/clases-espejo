import { IsNotEmpty, IsString } from 'class-validator';
import { EsTextoValido } from '../../common/validators/es-texto-valido';

/**
 * Datos de la persona que comparten las dos altas: el registro de un agente
 * (`RegisterDto`) y la activación de la cuenta invitada (`ActivateAccountDto`).
 *
 * Las dos puertas piden exactamente lo mismo, así que las reglas viven aquí una
 * sola vez: el día que cambie una, cambia en las dos. (class-validator valida
 * también las propiedades heredadas.)
 */
export class DatosPersonaDto {
  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  nombres: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  apellidoPaterno: string;

  @IsString()
  @IsNotEmpty()
  @EsTextoValido()
  apellidoMaterno: string;

  @IsString()
  @IsNotEmpty()
  tipoDocumento: string;

  @IsString()
  @IsNotEmpty()
  dni: string;
}
