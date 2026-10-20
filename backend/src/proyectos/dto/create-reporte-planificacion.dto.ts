import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateReportePlanificacionDto {
  @IsBoolean()
  vistoBueno!: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
