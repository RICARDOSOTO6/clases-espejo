import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { PasoGuia } from '../../../core/constants/guia';

/** Cuadro que resalta el elemento del paso actual. */
interface Foco {
  top: number;
  left: number;
  width: number;
  height: number;
}

const MARGEN = 12;
/** Reintentos de medición: el objetivo puede aparecer tras abrir una ventana. */
const INTENTOS_MAXIMOS = 12;
const ESPERA_MS = 80;

/**
 * Guía interactiva: oscurece la pantalla, resalta el elemento de cada paso y
 * explica qué hacer. No bloquea los clics, así el usuario puede pulsar el botón
 * señalado mientras lee.
 */
@Component({
  selector: 'app-guia',
  templateUrl: './guia.component.html',
})
export class GuiaComponent implements OnInit, OnDestroy {
  /** Pasos del recorrido, según el rol. */
  @Input() pasos: PasoGuia[] = [];
  /** Se emite al terminar o al salir. */
  @Output() cerrar = new EventEmitter<void>();
  /** Petición a la pantalla: abrir o cerrar un formulario. */
  @Output() accion = new EventEmitter<NonNullable<PasoGuia['accion']>>();

  readonly indice = signal(0);
  readonly foco = signal<Foco | null>(null);
  readonly colocacion = signal<'abajo' | 'arriba' | 'centrado'>('centrado');

  private readonly panel = viewChild<ElementRef<HTMLDivElement>>('panel');
  private intentos = 0;
  private temporizador?: ReturnType<typeof setTimeout>;

  readonly actual = computed<PasoGuia | null>(
    () => this.pasos[this.indice()] ?? null,
  );
  readonly esUltimo = computed(() => this.indice() === this.pasos.length - 1);
  readonly altoPanel = signal(190);

  ngOnInit(): void {
    window.addEventListener('resize', this.medir);
    // `true`: también al desplazarse dentro de un contenedor.
    window.addEventListener('scroll', this.medir, true);
    this.entrarEn(0);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.medir);
    window.removeEventListener('scroll', this.medir, true);
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  // --- Navegación ---

  siguiente(): void {
    if (this.esUltimo()) {
      this.salir();
      return;
    }
    this.entrarEn(this.indice() + 1);
  }

  anterior(): void {
    if (this.indice() === 0) return;
    this.entrarEn(this.indice() - 1);
  }

  salir(): void {
    this.cerrar.emit();
  }

  @HostListener('document:keydown.escape')
  alPulsarEscape(): void {
    this.salir();
  }

  @HostListener('document:keydown.arrowright')
  @HostListener('document:keydown.enter')
  alAvanzar(): void {
    this.siguiente();
  }

  @HostListener('document:keydown.arrowleft')
  alRetroceder(): void {
    this.anterior();
  }

  // --- Medición ---

  /** Entra en un paso: avisa a la pantalla y localiza su elemento. */
  private entrarEn(indice: number): void {
    if (indice < 0 || indice >= this.pasos.length) return;
    this.indice.set(indice);

    const paso = this.pasos[indice];
    if (paso.accion) this.accion.emit(paso.accion);

    this.intentos = 0;
    this.foco.set(null);
    if (!paso.selector) {
      this.colocacion.set('centrado');
      this.enfocarPanel();
      return;
    }

    // Se espera un poco a que la pantalla reaccione (abrir la ventana, cambiar
    // de sección) antes de medir.
    this.temporizador = setTimeout(() => this.localizar(), ESPERA_MS);
  }

  private localizar(): void {
    const paso = this.actual();
    if (!paso?.selector) return;

    const elemento = document.querySelector<HTMLElement>(paso.selector);
    if (!elemento) {
      // El elemento todavía no existe: se reintenta y, si no aparece, se salta.
      if (this.intentos < INTENTOS_MAXIMOS) {
        this.intentos += 1;
        this.temporizador = setTimeout(() => this.localizar(), ESPERA_MS);
        return;
      }
      if (this.esUltimo()) this.salir();
      else this.entrarEn(this.indice() + 1);
      return;
    }

    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.medir();
    this.medirPanel();
    this.enfocarPanel();
  }

  /** Recoloca el resaltado sin mover la página (para scroll y resize). */
  private medir = (): void => {
    const paso = this.actual();
    if (!paso?.selector) return;
    const elemento = document.querySelector<HTMLElement>(paso.selector);
    if (!elemento) return;

    const r = elemento.getBoundingClientRect();
    this.foco.set({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
    this.colocacion.set(
      r.top > window.innerHeight * 0.45 ? 'arriba' : 'abajo',
    );
  };

  /** El panel se mide para saber si cabe debajo del elemento. */
  private medirPanel(): void {
    const el = this.panel()?.nativeElement;
    if (el) this.altoPanel.set(el.getBoundingClientRect().height);
  }

  private enfocarPanel(): void {
    setTimeout(() => {
      this.medirPanel();
      this.panel()?.nativeElement
        ?.querySelector<HTMLButtonElement>('.guia-siguiente')
        ?.focus();
    });
  }

  // --- Posición del panel ---

  readonly posicionPanel = computed(() => {
    const foco = this.foco();
    if (!foco || this.colocacion() === 'centrado') return {};

    const ancho = Math.min(360, window.innerWidth - MARGEN * 2);
    const izquierda = Math.min(
      Math.max(MARGEN, foco.left + foco.width / 2 - ancho / 2),
      window.innerWidth - ancho - MARGEN,
    );

    if (this.colocacion() === 'arriba') {
      // Se ancla por abajo para que el panel no se salga por el borde superior.
      return {
        left: `${izquierda}px`,
        width: `${ancho}px`,
        bottom: `${window.innerHeight - foco.top + MARGEN}px`,
      };
    }
    const arriba = Math.min(
      foco.top + foco.height + MARGEN,
      window.innerHeight - this.altoPanel() - MARGEN,
    );
    return {
      left: `${izquierda}px`,
      width: `${ancho}px`,
      top: `${Math.max(MARGEN, arriba)}px`,
    };
  });
}
