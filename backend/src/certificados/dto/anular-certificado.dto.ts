import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Anulación de un certificado ya emitido.
 *
 * El motivo es **obligatorio**: un certificado se anula porque hay un error en
 * el nombre, porque se emitió por duplicado o porque el alumno no cumplió los
 * requisitos, y quien lo mire después (o el propio alumno) tiene derecho a saber
 * cuál de esas cosas pasó. Un certificado anulado sin explicación es un
 * documento marcado sin defensa.
 *
 * El mínimo de tres caracteres está para que un motivo vacío o de una letra no
 * cuele por la puerta de atrás; el servicio además recorta los espacios, así que
 * un motivo en blanco tampoco pasa.
 */
export class AnularCertificadoDto {
  @IsString({ message: 'Hay que explicar por qué se anula el certificado' })
  @MinLength(3, {
    message:
      'El motivo de la anulación es obligatorio y tiene que explicar qué pasó',
  })
  @MaxLength(300, { message: 'El motivo es demasiado largo (máximo 300 caracteres)' })
  motivo!: string;
}
