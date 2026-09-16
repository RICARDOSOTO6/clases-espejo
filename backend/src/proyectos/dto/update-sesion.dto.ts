import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ESTADOS_SESION } from '../../common/estados';

export class UpdateSesionDto {
  @IsString()
  @IsOptional()
  titulo?: string;

  @IsDateString()
  @IsOptional()
  fechaHora?: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'], require_tld: false })
  @IsOptional()
  enlaceVirtual?: string;

  @IsString()
  @IsIn(ESTADOS_SESION)
  @IsOptional()
  estado?: string;
}
