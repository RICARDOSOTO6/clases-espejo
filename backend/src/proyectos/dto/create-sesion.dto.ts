import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ESTADOS_SESION } from '../../common/estados';

export class CreateSesionDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsDateString()
  fechaHora: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'], require_tld: false })
  enlaceVirtual: string;

  @IsString()
  @IsIn(ESTADOS_SESION)
  @IsOptional()
  estado?: string;
}
