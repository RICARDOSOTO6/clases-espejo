import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmarReporteClaseDto {
  @IsString()
  @IsNotEmpty()
  observaciones: string;
}
