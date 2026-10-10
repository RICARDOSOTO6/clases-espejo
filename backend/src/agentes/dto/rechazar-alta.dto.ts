import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Motivo del rechazo de un alta de agente.
 *
 * Aquí, a diferencia del rechazo de una institución (que sí lo exige), es
 * **opcional**: el agente de la institución puede rechazar un alta sin dar
 * explicaciones, y el correo que recibe la persona rechazada simplemente no
 * lleva motivo.
 */
export class RechazarAltaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
