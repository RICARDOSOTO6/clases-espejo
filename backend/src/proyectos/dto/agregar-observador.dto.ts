import { IsInt, Min } from 'class-validator';

export class AgregarObservadorDto {
  @IsInt()
  @Min(1)
  institucionId!: number;
}
