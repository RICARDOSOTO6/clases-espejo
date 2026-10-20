import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Motivo de una decisión sobre una institución. Es obligatorio tanto al
 * rechazar como al vetar: el agente tiene que saber **por qué** se le cierra la
 * puerta, y sin motivo la institución no puede corregir nada.
 */
export class DecisionInstitucionDto {
  @IsString()
  @IsNotEmpty({ message: 'Indica el motivo de la decisión' })
  motivo!: string;
}
