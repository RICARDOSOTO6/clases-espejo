import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateActividadDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  instrucciones: string;

  @IsDateString()
  fechaLimite: string;
}
