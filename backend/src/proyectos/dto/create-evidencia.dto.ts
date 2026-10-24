import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateEvidenciaDto {
  @IsString()
  @IsOptional()
  tipo?: string;

  /**
   * Enlace externo. La validación de dominio y protocolo se hace en el
   * servicio, que es quien conoce la lista blanca y el mensaje exacto.
   */
  @IsString()
  @IsOptional()
  enlaceUrl?: string;

  /** Sesión a la que pertenece la evidencia (opcional). */
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsInt()
  @IsOptional()
  sesionId?: number;
}
