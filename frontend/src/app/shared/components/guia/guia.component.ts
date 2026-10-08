import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  computed,
  ElementRef,
  SimpleChanges,
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
 *
 * Recorre un apartado cada vez: el esqueleto le pasa los pasos del apartado en
 * el que está el usuario (`pasos`) y su nombre (`apartado`). Si cambia de
 * apartado, los pasos cambian y la guía vuelve al primer paso.
 */
@Component({
  selector: 'app-guia',
  templateUrl: './guia.component.html',
})
export class GuiaComponent implements OnInit, OnDestroy, OnChanges {
  /** Pasos del recorrido del apartado actual. */
  @Input() pasos: PasoGuia[] = [];
  /** Nombre del apartado, para que el usuario sepa dónde está. */
  @Input() apartado = '';
  /** Se emite al terminar o al salir. */
  @Output() cerrar = new EventEmitter<void>();
  /** Petición a la pantalla: abrir o cerrar un formulario. */
  @Output() accion = new EventEmitter<NonNullable<PasoGuia['accion']>>();

  readonly indice = signal(0);
  readonly foco = signal<Foco | null>(null);
  readonly colocacion = signal<'abajo' | 'arriba' | 'centrado'>('centrado');

  private readonly panel = viewChild<ElementRef<HTMLDivElement>>('panel');
  private intentos = 0;
  private buscando = false;
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

  /**
   * Si cambia el recorrido (el usuario se movió a otro apartado con la guía
   * abierta) se vuelve al primer paso de ese apartado.
   */
  ngOnChanges(cambios: SimpleChanges): void {
    const nuevoRecorrido = cambios['pasos'];
    if (!nuevoRecorrido || nuevoRecorrido.firstChange) return;
    this.entrarEn(0);
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

  @HostListener('document:keydown.arrowright', ['$event'])
  @HostListener('document:keydown.enter', ['$event'])
  alAvanzar(evento?: Event): void {
    if (this.escribiendo(evento)) return;
    this.siguiente();
  }

  @HostListener('document:keydown.arrowleft', ['$event'])
  alRetroceder(evento?: Event): void {
    if (this.escribiendo(evento)) return;
    this.anterior();
  }

  /** Dentro de un campo (o de un botón) las flechas y Enter son del formulario. */
  private escribiendo(evento?: Event): boolean {
    const destino = evento?.target as HTMLElement | null;
    if (!destino?.closest) return false;
    return !!destino.closest('input, textarea, select, button, [contenteditable]');
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
    if (!paso.selector && !paso.boton) {
      this.buscando = false;
      this.colocacion.set('centrado');
      this.enfocarPanel();
      return;
    }

    // Se espera un poco a que la pantalla reaccione (abrir la ventana, cambiar
    // de sección) antes de medir.
    this.buscando = true;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.localizar(), ESPERA_MS);
  }

  private localizar(): void {
    const paso = this.actual();
    if (!paso || (!paso.selector && !paso.boton)) {
      this.buscando = false;
      return;
    }

    const elemento = this.resolver(paso);
    if (!elemento) {
      // El elemento todavía no existe: se reintenta y, si no aparece, se salta.
      if (this.intentos < INTENTOS_MAXIMOS) {
        this.intentos += 1;
        this.temporizador = setTimeout(() => this.localizar(), ESPERA_MS);
        return;
      }
      this.buscando = false;
      if (this.esUltimo()) this.salir();
      else this.entrarEn(this.indice() + 1);
      return;
    }

    this.buscando = false;
    // Desplazamiento inmediato a propósito: con `smooth` la medida y el panel se
    // calculan antes de que termine el desplazamiento y el panel puede aparecer
    // fuera de la pantalla durante un instante.
    elemento.scrollIntoView({ behavior: 'auto', block: 'center' });
    this.medir();
    this.medirPanel();
    this.enfocarPanel();
  }

  /** La pantalla cambió: se vuelve a buscar el objetivo del paso actual. */
  private buscarDeNuevo(): void {
    this.intentos = 0;
    this.buscando = true;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.localizar(), ESPERA_MS);
  }

  /**
   * Localiza el elemento de un paso: primero por selector CSS y, si no aparece,
   * por el texto visible del botón o enlace (`boton`). Así una etiqueta
   * dinámica («Revisar (origen)») o un control sin `id` no rompen el recorrido.
   */
  private resolver(paso: PasoGuia): HTMLElement | null {
    if (paso.selector) {
      const porSelector = document.querySelector<HTMLElement>(paso.selector);
      if (porSelector) return porSelector;
    }
    if (!paso.boton) return null;

    const buscado = paso.boton.toLocaleLowerCase();
    const candidatos = document.querySelectorAll<HTMLElement>(
      'button, a, [role="button"]',
    );
    for (const elemento of Array.from(candidatos)) {
      const visible =
        elemento.offsetParent !== null || elemento.getClientRects().length > 0;
      const etiqueta = (elemento.textContent ?? '').toLocaleLowerCase();
      if (visible && etiqueta.includes(buscado)) return elemento;
    }
    return null;
  }

  /** Recoloca el resaltado sin mover la página (para scroll y resize). */
  private medir = (): void => {
    const paso = this.actual();
    if (!paso || (!paso.selector && !paso.boton)) return;
    const elemento = this.resolver(paso);
    if (!elemento) {
      // El usuario navegó mientras la guía estaba abierta: se quita el resaltado
      // viejo y se busca el nuevo objetivo (si de verdad no existe, se salta).
      this.foco.set(null);
      if (!this.buscando) this.buscarDeNuevo();
      return;
    }

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
