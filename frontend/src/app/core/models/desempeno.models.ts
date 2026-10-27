/** Contadores de desempeño que devuelve la API. */
export interface ContadoresProyectos {
  total: number;
  finalizados: number;
  enCurso: number;
  enPlanificacion: number;
  cancelados: number;
  noConcluidos: number;
}

export interface ContadoresSolicitudes {
  total: number;
  aprobadas: number;
  pendientes: number;
  rechazadas: number;
  caducadas: number;
}

export interface ContadoresActividad {
  sesiones: number;
  reportes: number;
  evidencias: number;
  certificados: number;
  evaluaciones: number;
}

export interface FilaDesempeno {
  id: number;
  nombre: string;
  detalle: string;
  logoUrl: string | null;
  proyectos: ContadoresProyectos;
  solicitudes: ContadoresSolicitudes;
  actividad: ContadoresActividad;
  tasaCierre: number;
  tasaRechazo: number;
  tasaReportes: number;
}

export interface ResumenDesempeno {
  proyectos: ContadoresProyectos;
  solicitudes: ContadoresSolicitudes;
  actividad: ContadoresActividad;
  tasaCierre: number;
  tasaRechazo: number;
}

export interface DesempenoCace {
  resumen: ResumenDesempeno;
  instituciones: FilaDesempeno[];
}

export interface DesempenoAgente {
  resumen: ResumenDesempeno;
  docentes: FilaDesempeno[];
}
