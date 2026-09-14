import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMensajeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  contenido: string;
}
