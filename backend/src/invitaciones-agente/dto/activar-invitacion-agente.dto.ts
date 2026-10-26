import { IsString } from 'class-validator';
import { RegisterDto } from '../../auth/dto/register.dto';

/**
 * Activación de una invitación de agente. La presidencia no elige institución:
 * el agente la crea en este cuestionario.
 */
export class ActivarInvitacionAgenteDto extends RegisterDto {
  @IsString()
  token!: string;
}
