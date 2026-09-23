/** Nivel de urgencia de un plazo, calculado por el backend. */
export type Urgencia = 'VENCIDA' | 'CRITICA' | 'PROXIMA' | 'NORMAL';

/** Una solicitud con su plazo de respuesta. */
export interface SolicitudAgenda {
  id: number;
  titulo: string;
  estado: string;
  fechaPropuesta: string;
  fechaLimite: string;
  diasRestantes: number;
  urgencia: Urgencia;
  /** Etapa que le toca ahora: respuesta del origen o confirmación del destino. */
  etapa: 'ORIGEN' | 'DESTINO';
  /** Si la siguiente decisión depende de la institución del usuario. */
  meToca: boolean;
  contraparte: string;
  docente: string;
}

/** Una clase espejo programada (una sesión). */
export interface ClaseAgenda {
  id: number;
  proyectoId: number;
  titulo: string;
  fechaHora: string;
  estado: string;
  enlaceVirtual: string;
  contraparte: string;
}

/** Algo por hacer sin fecha límite de solicitud. */
export interface TareaAgenda {
  tipo: string;
  titulo: string;
  detalle: string;
  proyectoId: number;
  urgencia: Urgencia;
}

/** Agenda completa que devuelve `GET /recordatorios`. */
export interface Agenda {
  generadoEn: string;
  /** Solicitudes que caducaron en esta consulta por falta de respuesta. */
  caducadasAhora: number;
  resumen: {
    vencidas: number;
    criticas: number;
    proximas: number;
    enRevision: number;
    clasesProximas: number;
    tareas: number;
  };
  solicitudes: SolicitudAgenda[];
  clases: ClaseAgenda[];
  tareas: TareaAgenda[];
}
