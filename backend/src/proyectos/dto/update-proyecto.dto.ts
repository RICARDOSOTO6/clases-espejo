import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ESTADOS_PROYECTO_EDITABLES } from '../../common/estados';

export class UpdateProyectoDto {
  /**
   * Solo estados "de trabajo": el cierre a FINALIZADO se hace con
   * `POST /proyectos/:id/cerrar`, que valida evaluación y reportes.
   */
  @IsString()
  @IsIn(ESTADOS_PROYECTO_EDITABLES)
  @IsOptional()
  estado?: string;

  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  plataforma?: string;
}
