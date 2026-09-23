import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ClaseAgenda,
  SolicitudAgenda,
  Urgencia,
} from '../../../core/models/recordatorio.models';
import {
  avisoUrgencia,
  claseUrgencia,
  etiquetaUrgencia,
} from '../../../core/utils/urgencia.util';
import { ModalComponent } from '../modal/modal.component';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MS_DIA = 24 * 60 * 60 * 1000;
/** Cuántos puntos caben en una casilla antes de resumir el resto. */
const MAX_PUNTOS = 4;

/** Una casilla del calendario. */
interface DiaCalendario {
  clave: string;
  fecha: Date;
  numero: number;
  delMes: boolean;
  esHoy: boolean;
  clases: ClaseAgenda[];
  vencimientos: SolicitudAgenda[];
  /** Puntos que se pintan dentro de la casilla. */
  puntos: { clase: boolean; urgencia: Urgencia }[];
  /** Cuántos eventos no caben como punto. */
  restantes: number;
}

/** Clave local `YYYY-MM-DD` (con `toISOString` se adelantaba un día). */
function clave(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function inicioDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/**
 * Calendario mensual en una ventana emergente: una casilla por día con las
 * sesiones programadas y los vencimientos de solicitudes. Al pulsar un día se
 * muestra el detalle de lo que ocurre ese día.
 */
@Component({
  selector: 'app-calendario',
  imports: [RouterLink, ModalComponent],
  templateUrl: './calendario.component.html',
})
export class CalendarioComponent {
  /** Sesiones futuras de las clases espejo del usuario. */
  @Input() clases: ClaseAgenda[] = [];
  /** Solicitudes con su plazo de respuesta. */
  @Input() vencimientos: SolicitudAgenda[] = [];

  /** Se emite al cerrar la ventana. */
  @Output() cerrar = new EventEmitter<void>();

  readonly diasSemana = DIAS_SEMANA;
  readonly mes = signal(inicioDeMes(new Date()));
  readonly diaElegido = signal<string | null>(null);

  readonly tituloMes = computed(() => {
    const texto = this.mes().toLocaleDateString('es-MX', {
      month: 'long',
      year: 'numeric',
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });

  /** Las seis semanas (42 casillas) que cubren el mes visible. */
  readonly dias = computed<DiaCalendario[]>(() => {
    const primero = this.mes();
    // La semana empieza en lunes: se retrocede hasta el lunes anterior.
    const desfase = (primero.getDay() + 6) % 7;
    const inicio = sumarDias(primero, -desfase);
    const hoy = clave(new Date());

    const casillas: DiaCalendario[] = [];
    const porClave = new Map<string, DiaCalendario>();
    for (let i = 0; i < 42; i++) {
      const fecha = sumarDias(inicio, i);
      const dia: DiaCalendario = {
        clave: clave(fecha),
        fecha,
        numero: fecha.getDate(),
        delMes: fecha.getMonth() === primero.getMonth(),
        esHoy: clave(fecha) === hoy,
        clases: [],
        vencimientos: [],
        puntos: [],
        restantes: 0,
      };
      casillas.push(dia);
      porClave.set(dia.clave, dia);
    }

    // Índice por día: evita recorrer todo el calendario por cada evento.
    for (const clase of this.clases) {
      porClave.get(clave(new Date(clase.fechaHora)))?.clases.push(clase);
    }
    for (const vencimiento of this.vencimientos) {
      porClave.get(clave(new Date(vencimiento.fechaLimite)))?.vencimientos.push(
        vencimiento,
      );
    }

    for (const dia of casillas) {
      const puntos: { clase: boolean; urgencia: Urgencia }[] = [
        ...dia.clases.map(() => ({ clase: true, urgencia: 'NORMAL' as Urgencia })),
        ...dia.vencimientos.map((v) => ({ clase: false, urgencia: v.urgencia })),
      ];
      dia.puntos = puntos.slice(0, MAX_PUNTOS);
      dia.restantes = Math.max(0, puntos.length - MAX_PUNTOS);
    }

    return casillas;
  });

  /** Día elegido (o el de hoy si todavía no se ha pulsado ninguno). */
  readonly detalleDelDia = computed<DiaCalendario | null>(() => {
    const elegido = this.diaElegido();
    const lista = this.dias();
    if (elegido) return lista.find((d) => d.clave === elegido) ?? null;
    return lista.find((d) => d.esHoy) ?? null;
  });

  readonly tituloDia = computed(() => {
    const dia = this.detalleDelDia();
    if (!dia) return '';
    const texto = dia.fecha.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });

  /** Resumen en una línea de lo que hay ese día. */
  readonly resumenDia = computed(() => {
    const dia = this.detalleDelDia();
    if (!dia) return '';
    const partes: string[] = [];
    if (dia.clases.length > 0) {
      partes.push(
        dia.clases.length === 1
          ? '1 clase espejo programada'
          : `${dia.clases.length} clases espejo programadas`,
      );
    }
    if (dia.vencimientos.length > 0) {
      partes.push(
        dia.vencimientos.length === 1
          ? '1 solicitud pendiente de respuesta'
          : `${dia.vencimientos.length} solicitudes pendientes de respuesta`,
      );
    }
    return partes.join(' · ');
  });

  // --- Navegación ---

  mesAnterior(): void {
    this.mes.update((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  mesSiguiente(): void {
    this.mes.update((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  irHoy(): void {
    this.mes.set(inicioDeMes(new Date()));
    this.diaElegido.set(null);
  }

  elegir(dia: DiaCalendario): void {
    this.diaElegido.set(dia.clave);
  }

  // --- Presentación ---

  etiqueta(urgencia: Urgencia, dias: number): string {
    return etiquetaUrgencia(urgencia, dias);
  }

  clase(urgencia: Urgencia): string {
    return claseUrgencia(urgencia);
  }

  aviso(urgencia: Urgencia): string | null {
    return avisoUrgencia(urgencia);
  }

  hora(fecha: Date | string): string {
    return new Date(fecha).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  etiquetaDia(dia: DiaCalendario): string {
    const total = dia.clases.length + dia.vencimientos.length;
    const base = dia.fecha.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return total === 0
      ? base
      : `${base}: ${dia.clases.length} clase(s) y ${dia.vencimientos.length} vencimiento(s)`;
  }
}
