import { IsIn, IsOptional, IsString } from 'class-validator';

export class RevisarSolicitudDto {
  @IsString()
  @IsIn(['APROBADA', 'RECHAZADA'])
  decision: string;

  @IsString()
  @IsOptional()
  comentario?: string;
}
