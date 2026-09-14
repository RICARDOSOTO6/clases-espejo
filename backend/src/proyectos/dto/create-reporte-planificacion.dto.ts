import { IsNotEmpty, IsString } from 'class-validator';

export class CreateReportePlanificacionDto {
  @IsString()
  @IsNotEmpty()
  acuerdos: string;

  @IsString()
  @IsNotEmpty()
  calendario: string;

  @IsString()
  @IsNotEmpty()
  actividadesAcordadas: string;
}
