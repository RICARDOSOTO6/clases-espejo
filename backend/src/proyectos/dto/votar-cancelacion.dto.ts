import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class VotarCancelacionDto {
  @IsString()
  @IsIn(['APROBADA', 'RECHAZADA'])
  decision!: 'APROBADA' | 'RECHAZADA';

  @IsString()
  @MinLength(3)
  @IsOptional()
  motivo?: string;
}
