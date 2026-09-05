import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class InviteDocenteDto {
  @IsEmail()
  correo: string;

  @IsString()
  @IsNotEmpty()
  numeroEmpleado: string;
}
