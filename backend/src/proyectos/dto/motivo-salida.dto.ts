import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class MotivoSalidaDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  motivo!: string;
}
