import { IsEmail, IsOptional } from 'class-validator';

/** Invitación de la secretaría de institución. El correo es opcional. */
export class CrearInvitacionSecretariaDto {
  @IsOptional()
  @IsEmail({}, { message: 'El correo de la invitación no es válido' })
  correo?: string;
}
