import { IsString, Length, Matches } from 'class-validator';

export class DesactivarTotpDto {
  @IsString()
  @Length(6, 200)
  password!: string;

  @IsString()
  @Length(6, 16)
  @Matches(/^[A-Za-z0-9 -]+$/, {
    message: 'Escribe el código de 6 dígitos o un código de recuperación',
  })
  codigo!: string;
}
