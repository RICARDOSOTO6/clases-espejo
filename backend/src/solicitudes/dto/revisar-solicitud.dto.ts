import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class RevisarSolicitudDto {
  @IsString()
  @IsIn(['APROBADA', 'RECHAZADA'])
  decision: string;

  @IsString()
  @IsOptional()
  comentario?: string;

  @IsInt()
  @IsOptional()
  asignacionDestinoId?: number;
}
