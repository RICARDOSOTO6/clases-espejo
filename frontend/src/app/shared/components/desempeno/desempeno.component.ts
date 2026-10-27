import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DesempenoService } from '../../../core/services/desempeno.service';
import {
  DesempenoAgente,
  DesempenoCace,
  FilaDesempeno,
} from '../../../core/models/desempeno.models';
import { extraerMensajeError } from '../../../core/utils/http-error.util';
import { urlDeArchivo } from '../../../core/utils/url-archivo.util';

/**
 * Panel de desempeño compartido por la CACE y el agente.
 *
 * - `cace`: cada fila es una institución.
 * - `agente`: cada fila es un docente de la institución del agente.
 *
 * Las barras son CSS puro: no hace falta una librería de gráficas y funcionan
 * con el tema de la aplicación.
 */
@Component({
  selector: 'app-desempeno',
  templateUrl: './desempeno.component.html',
  styleUrl: './desempeno.component.css',
})
export class DesempenoComponent implements OnInit {
  private readonly desempeno = inject(DesempenoService);

  readonly ambito = input.required<'cace' | 'agente'>();

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly datos = signal<DesempenoCace | DesempenoAgente | null>(null);

  readonly filas = computed<FilaDesempeno[]>(() => {
    const datos = this.datos();
    if (!datos) return [];
    return 'instituciones' in datos ? datos.instituciones : datos.docentes;
  });

  readonly resumen = computed(() => this.datos()?.resumen ?? null);

  readonly titulo = computed(() =>
    this.ambito() === 'cace' ? 'Desempeño de las instituciones' : 'Desempeño de tus docentes',
  );

  readonly subtitulo = computed(() =>
    this.ambito() === 'cace'
      ? 'Clases espejo y solicitudes por universidad. Una clase compartida suma para las dos instituciones.'
      : 'Clases espejo y solicitudes por docente. Una clase compartida suma para los dos docentes.',
  );

  readonly etiquetaFila = computed(() => (this.ambito() === 'cace' ? 'Institución' : 'Docente'));

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    const peticion: Observable<DesempenoCace | DesempenoAgente> =
      this.ambito() === 'cace' ? this.desempeno.cace() : this.desempeno.agente();

    peticion.subscribe({
      next: (datos) => {
        this.datos.set(datos);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.datos.set(null);
        this.cargando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo cargar el panel de desempeño'));
      },
    });
  }

  imagen(logoUrl: string | null): string | null {
    return logoUrl ? urlDeArchivo(logoUrl) : null;
  }

  porcentaje(parte: number, total: number): number {
    return total > 0 ? Math.round((parte / total) * 100) : 0;
  }
}
