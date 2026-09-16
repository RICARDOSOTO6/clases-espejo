import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateEvidenciaDto {
  @IsString()
  @IsOptional()
  tipo?: string;

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
