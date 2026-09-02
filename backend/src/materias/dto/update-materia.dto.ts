import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateMateriaDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  clave?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  programaEducativo?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}
