import { IsString, Length, Matches } from 'class-validator';

export class ConfirmarTotpDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Escribe el código de 6 dígitos' })
  codigo!: string;
}
