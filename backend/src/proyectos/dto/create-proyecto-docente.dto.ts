import { IsIn, IsInt, IsString } from 'class-validator';

export class CreateProyectoDocenteDto {
  @IsInt()
  asignacionDocenteId: number;

  @IsString()
  @IsIn(['ORIGEN', 'DESTINO'])
  rol: string;
}
