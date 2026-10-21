import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { EsTextoValido } from '../../common/validators/es-texto-valido';
import { DatosPersonaDto } from './datos-persona.dto';
import { PASSWORD_MINIMO } from '../../common/politica-password';

/**
 * Alta de un agente de internacionalización.
 *
 * Hay dos caminos, y los dos empiezan igual (los datos de la persona):
 *
 * - **Unirse a una institución que ya existe** (`institucionId`): los datos de
 *   la institución no hacen falta, porque ya los tiene. Si está aprobada, el
 *   alta queda pendiente de que la confirme un agente de esa institución; si
 *   está pendiente, la decide el presidente al aprobarla.
 * - **Crear una institución nueva** (sin `institucionId`): entonces sí hacen
 *   falta sus datos, y nace **pendiente** de aprobación por la CACE.
 */
export class RegisterDto extends DatosPersonaDto {
  @IsEmail()
  correo!: string;

  @IsString()
  @MinLength(PASSWORD_MINIMO, {
    message: `La contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres`,
  })
  password!: string;

  /** Institución existente a la que se une el agente (buscar antes de crear). */
  @IsOptional()
  @IsInt()
  institucionId?: number;

  // --- Datos de la institución: solo si se crea una nueva ---

  @IsOptional()
  @IsString()
  @EsTextoValido()
  nombreInstitucion?: string;

  @IsOptional()
  @IsString()
  pais?: string;

  @IsOptional()
  @IsString()
  codigoPais?: string;

  @IsOptional()
  @IsString()
  @EsTextoValido()
  estado?: string;

  @IsOptional()
  @IsString()
  @EsTextoValido()
  ciudad?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  correoInstitucional?: string;

  @IsString()
  @IsNotEmpty()
  cargo!: string;
}
