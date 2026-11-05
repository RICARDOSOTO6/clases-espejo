import { IsInt, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ActivarPerfilDocenteDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  gradoAcademico!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  especialidad!: string;

  @IsString()
  @IsNotEmpty()
  numeroEmpleado!: string;

  @IsInt()
  materiaId!: number;

  @IsString()
  @IsNotEmpty()
  periodoEscolar!: string;
}
