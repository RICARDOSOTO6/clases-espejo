import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEvaluacionDto {
  @IsString()
  @IsNotEmpty()
  instrumento: string;

  @IsString()
  @IsNotEmpty()
  resultado: string;

  @IsString()
  @IsNotEmpty()
  observaciones: string;
}
