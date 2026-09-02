import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class InviteDocenteDto {
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  gradoAcademico: string;

  @IsString()
  @IsNotEmpty()
  especialidad: string;

  @IsString()
  @IsNotEmpty()
  numeroEmpleado: string;
}
