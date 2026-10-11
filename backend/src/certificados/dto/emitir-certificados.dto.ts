import { IsBoolean, IsInt, IsOptional } from 'class-validator';

/**
 * Emisión de certificados de una clase espejo cerrada.
 *
 * Sin `alumnoId` se emiten todos los alumnos que el docente dejó
 * `incluido = true` en la lista de su institución. Con `alumnoId`, solo ese.
 *
 * `reemitir` existe porque **un certificado no se duplica**: si el alumno ya
 * tiene uno emitido, la emisión se niega con un mensaje claro y hay que pedir
 * la reemisión a propósito. Al reemitir, el anterior queda `ANULADO` con su
 * motivo y el nuevo folio, así que el alumno nunca tiene dos certificados
 * válidos a la vez y queda rastro de por qué se cambió.
 */
export class EmitirCertificadosDto {
  @IsOptional()
  @IsInt({ message: 'El alumno indicado no es válido' })
  alumnoId?: number;

  @IsOptional()
  @IsBoolean()
  reemitir?: boolean;
}
