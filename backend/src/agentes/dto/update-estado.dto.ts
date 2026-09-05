import { IsBoolean } from 'class-validator';

export class UpdateEstadoDocenteDto {
  @IsBoolean()
  activo: boolean;
}
