import { Component, Input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ClaseAgenda,
  SolicitudAgenda,
  TareaAgenda,
  Urgencia,
} from '../../../core/models/recordatorio.models';
import {
  claseUrgencia,
  etiquetaUrgencia,
} from '../../../core/utils/urgencia.util';

const MS_DIA = 24 * 60 * 60 * 1000;

/** Un evento de la lista «lo próximo». */
interface EventoProximo {
  tipo: 'CLASE' | 'VENCIMIENTO';
  titulo: string;
  detalle: string;
  fecha: Date;
  urgencia: Urgencia;
  dias: number;
  proyectoId?: number;
  enlace?: string;
}

/** Días entre dos fechas, sin contar la hora. */
function diasEntre(desde: Date, hasta: Date): number {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b.getTime() - a.getTime()) / MS_DIA);
}

const PESO: Record<Urgencia, number> = {
  VENCIDA: 0,
  CRITICA: 1,
  PROXIMA: 2,
  NORMAL: 3,
};

/**
 * Lista de recordatorios: lo próximo (sesiones y vencimientos) y lo que falta
 * por hacer. El calendario mensual vive aparte, en su propia ventana.
 */
@Component({
  selector: 'app-agenda',
  imports: [RouterLink],
  templateUrl: './agenda.component.html',
})
export class AgendaComponent {
  /** Sesiones futuras de las clases espejo del usuario. */
  @Input() clases: ClaseAgenda[] = [];
  /** Solicitudes con su plazo de respuesta. */
  @Input() vencimientos: SolicitudAgenda[] = [];
  /** Lo que falta por hacer (sin fecha límite). */
  @Input() tareas: TareaAgenda[] = [];

  /** Lo próximo: clases y vencimientos desde hoy, en orden. */
  readonly proximos = computed<EventoProximo[]>(() => {
    const hoy = new Date();
    const eventos: EventoProximo[] = [
      ...this.clases.map((clase) => {
        const fecha = new Date(clase.fechaHora);
        const dias = diasEntre(hoy, fecha);
        return {
          tipo: 'CLASE' as const,
          titulo: clase.titulo,
          detalle: `${clase.contraparte} · ${fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`,
          fecha,
          urgencia: (dias <= 1
            ? 'CRITICA'
            : dias <= 7
              ? 'PROXIMA'
              : 'NORMAL') as Urgencia,
          dias,
          proyectoId: clase.proyectoId,
          enlace: clase.enlaceVirtual,
        };
      }),
      ...this.vencimientos.map((vencimiento) => ({
        tipo: 'VENCIMIENTO' as const,
        titulo: vencimiento.titulo,
        detalle: `Plazo de respuesta: ${vencimiento.etapa === 'ORIGEN' ? 'revisión de origen' : 'confirmación de destino'}`,
        fecha: new Date(vencimiento.fechaLimite),
        urgencia: vencimiento.urgencia,
        dias: vencimiento.diasRestantes,
        proyectoId: undefined,
        enlace: undefined,
      })),
    ];
    return eventos
      .filter((evento) => evento.dias >= 0)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
      .slice(0, 8);
  });

  readonly tareasOrdenadas = computed(() =>
    [...this.tareas].sort((a, b) => PESO[a.urgencia] - PESO[b.urgencia]),
  );

  etiqueta(urgencia: Urgencia, dias: number): string {
    return etiquetaUrgencia(urgencia, dias);
  }

  clase(urgencia: Urgencia): string {
    return claseUrgencia(urgencia);
  }

  /** Etiqueta corta para una tarea sin fecha límite. */
  etiquetaTarea(urgencia: Urgencia): string {
    return (
      {
        VENCIDA: 'Atrasada',
        CRITICA: 'Urgente',
        PROXIMA: 'Pronto',
        NORMAL: 'Cuando puedas',
      }[urgencia] ?? 'Pendiente'
    );
  }

  fechaLarga(fecha: Date | string): string {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
