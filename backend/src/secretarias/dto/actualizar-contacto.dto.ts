import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/** La secretaría solo mantiene los datos de contacto, no la identidad CACE. */
export class ActualizarContactoInstitucionDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo institucional no es válido' })
  correoInstitucional?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ciudad?: string;
}
