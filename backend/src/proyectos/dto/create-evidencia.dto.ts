import { IsOptional, IsString } from 'class-validator';

export class CreateEvidenciaDto {
  @IsString()
  @IsOptional()
  tipo?: string;
}
