import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class SaveReporteClaseDto {
  @IsString()
  @IsNotEmpty()
  desarrolloClase: string;

  @IsInt()
  @Min(0)
  totalAsistentes: number;

  @IsString()
  @IsNotEmpty()
  incidencias: string;

  @IsString()
  @IsNotEmpty()
  acuerdosSiguienteSesion: string;
}
