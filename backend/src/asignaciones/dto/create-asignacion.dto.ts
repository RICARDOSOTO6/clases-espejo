import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateAsignacionDto {
  @IsInt()
  docenteInstitucionId: number;

  @IsInt()
  materiaId: number;

  @IsString()
  @IsNotEmpty()
  periodoEscolar: string;
}
