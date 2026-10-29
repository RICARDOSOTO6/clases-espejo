import { IsInt, Min } from 'class-validator';

export class AgregarParticipanteDto {
  @IsInt()
  @Min(1)
  institucionId!: number;
}
