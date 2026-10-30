import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SolicitarCancelacionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  motivo!: string;
}
