import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** De dónde salió la lista, para poder rastrearlo después. */
const ORIGENES_LISTA = ['EXCEL', 'CSV', 'PEGADO'] as const;
export type OrigenLista = (typeof ORIGENES_LISTA)[number];

class AlumnoDto {
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  matricula?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  correo?: string;
}

export class GuardarListaDto {
  @IsIn(ORIGENES_LISTA)
  origen!: OrigenLista;

  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => AlumnoDto)
  alumnos!: AlumnoDto[];
}

/** Para el caso de pegar la lista a mano (sin archivo). */
export class PrevisualizarListaDto {
  @IsOptional()
  @IsString()
  @MaxLength(40000)
  texto?: string;
}

export class EditarAlumnoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  matricula?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  correo?: string;

  @IsOptional()
  @IsBoolean()
  incluido?: boolean;
}
