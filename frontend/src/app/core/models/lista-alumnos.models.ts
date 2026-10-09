/** De dónde salió la lista de alumnos. */
export type OrigenLista = 'EXCEL' | 'CSV' | 'PEGADO';

/** Una fila ya leída, antes de guardarla (puede traer avisos). */
export interface FilaLista {
  nombre: string;
  matricula: string;
  correo: string;
  avisos: string[];
}

/** Lo que devuelve la vista previa de un archivo o de un texto pegado. */
export interface PrevisualizacionLista {
  origen: OrigenLista;
  filas: FilaLista[];
  resumen: {
    total: number;
    listas: number;
    conAvisos: number;
    descartadas: number;
  };
  /** Avisos que no son de una fila concreta. */
  avisos: string[];
}

/** Un alumno ya guardado. */
export interface AlumnoLista {
  id: number;
  nombre: string;
  matricula: string;
  correo: string;
  /** Si entra o no en los certificados. */
  incluido: boolean;
}

/** La lista de alumnos de la institución del docente en una clase espejo. */
export interface ListaAlumnos {
  id: number;
  origen: OrigenLista;
  actualizadoEn: string;
  institucion: { id: number; nombre: string };
  subidaPor: string;
  alumnos: AlumnoLista[];
  resumen: { total: number; incluidos: number; sinCorreo: number };
}

/** Lo mínimo para guardar: la lista revisada que devolvió la vista previa. */
export interface AlumnoAGuardar {
  nombre: string;
  matricula?: string;
  correo?: string;
}
