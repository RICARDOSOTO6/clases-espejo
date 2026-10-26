import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/** Correo del docente e identificación para su expediente institucional. */
export class InvitarDocenteSecretariaDto {
  @IsEmail()
  correo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  numeroEmpleado?: string;
}
