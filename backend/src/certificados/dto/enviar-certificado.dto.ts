import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
} from 'class-validator';

/**
 * Envío de certificados por correo a los alumnos.
 *
 * Sin `alumnoIds` se envía a **todos** los alumnos que tengan certificado
 * vigente en la lista de la institución del docente; con ellos, solo a esos.
 *
 * `reenviar` hay que pedirlo a propósito: un alumno al que ya se le envió su
 * certificado **no lo recibe otra vez** salvo que el docente lo pida, que es
 * justo lo que evita mandar el mismo correo tres veces por descuido.
 */
export class EnviarCertificadosDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsInt({ each: true, message: 'La lista de alumnos no es válida' })
  @Type(() => Number)
  alumnoIds?: number[];

  @IsOptional()
  @IsBoolean()
  reenviar?: boolean;
}
