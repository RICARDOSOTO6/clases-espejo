import { IsString, Length, Matches } from 'class-validator';

export class VerificarTotpDto {
  @IsString()
  @Length(20, 2000)
  challengeToken!: string;

  @IsString()
  @Length(6, 16)
  @Matches(/^[A-Za-z0-9 -]+$/, {
    message: 'El código debe tener 6 dígitos o ser un código de recuperación',
  })
  codigo!: string;
}
