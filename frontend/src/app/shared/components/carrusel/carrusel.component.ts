import {
  Component,
  TemplateRef,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Lo que recibe la plantilla de cada diapositiva. `$implicit` es el elemento,
 * así que en la plantilla se escribe `<ng-template let-elemento>`.
 */
export interface CarruselContexto<T = any> {
  $implicit: T;
  indice: number;
}

/** Distancia mínima de un deslizamiento para que cuente como un gesto. */
const DESLIZAMIENTO_MINIMO = 40;
const INTERVALO_AUTOMATICO_MS = 6500;

/**
 * Carrusel reutilizable y accesible.
 *
 * Muestra **un elemento cada vez** y avanza automáticamente cuando hay más de
 * una diapositiva. Se pausa al pasar el ratón, recibir el foco o pulsar «Pausar»;
 * también ofrece botones de anterior y siguiente, indicadores y navegación con
 * las flechas del teclado.
 *
 * El aspecto lo pone cada pantalla: el carrusel no sabe qué enseña. Se le pasan
 * la lista y la plantilla de la ficha, con `let-elemento`:
 *
 * ```html
 * <ng-template #ficha let-elemento>
 *   <app-premio-tarjeta [premio]="elemento" />
 * </ng-template>
 *
 * <app-carrusel
 *   [items]="premios()"
 *   [plantilla]="ficha"
 *   etiqueta="Premios de la CACE"
 *   nombreElemento="reconocimiento"
 * />
 * ```
 *
 * La plantilla entra por un `input` (y no por `@ContentChild`) a propósito: los
 * `input` se asignan **antes** de que Angular pinte el componente, así que la
 * primera diapositiva ya sale pintada; una consulta de contenido depende del
 * orden de creación de las vistas y podría dejar el carrusel en blanco.
 *
 * Accesibilidad: la diapositiva que no se ve queda `aria-hidden` e `inert` (no
 * se puede enfocar con el tabulador y no se lee), cada diapositiva se anuncia
 * como «N de M», los botones llevan su nombre completo y un aviso con
 * `aria-live` cuenta en qué posición se está. Con `prefers-reduced-motion` los
 * estilos globales de la aplicación ya dejan el movimiento en nada.
 */
@Component({
  selector: 'app-carrusel',
  imports: [NgTemplateOutlet],
  templateUrl: './carrusel.component.html',
  styleUrl: './carrusel.component.css',
})
export class CarruselComponent<T = any> {
  /** Elementos que se exhiben, uno por diapositiva. */
  readonly items = input<readonly T[]>([]);

  /** Nombre del carrusel, para quien lo escucha con un lector de pantalla. */
  readonly etiqueta = input('Carrusel');

  /** Cómo se llama cada elemento en los avisos («reconocimiento 2 de 5»). */
  readonly nombreElemento = input('elemento');

  /**
   * Plantilla de cada diapositiva; recibe el elemento en `$implicit`. Es la que
   * pinta la ficha, así que el carrusel no se ata a ningún tipo de contenido.
   */
  readonly plantilla = input<TemplateRef<CarruselContexto<T>> | null>(null);

  private readonly indice = signal(0);
  private inicioToque: number | null = null;
  readonly pausaManual = signal(false);
  private readonly pausaPorInteraccion = signal(false);
  private readonly prefiereMenosMovimiento = signal(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );

  /** El avance automático respeta la pausa y las preferencias de movimiento. */
  readonly automaticoPausado = computed(
    () =>
      this.pausaManual() ||
      this.pausaPorInteraccion() ||
      this.prefiereMenosMovimiento(),
  );

  readonly etiquetaPausa = computed(() =>
    this.pausaManual() ? 'Reanudar carrusel' : 'Pausar carrusel',
  );

  /** ¿Hay más de un elemento? Con uno solo no hay nada que navegar. */
  readonly puedeNavegar = computed(() => this.items().length > 1);

  /** Sincroniza un único temporizador con la cantidad actual de diapositivas. */
  private readonly avanceAutomatico = effect((onCleanup) => {
    if (!this.puedeNavegar()) return;

    const temporizador = setInterval(() => {
      if (!this.automaticoPausado()) this.siguiente();
    }, INTERVALO_AUTOMATICO_MS);

    onCleanup(() => clearInterval(temporizador));
  });

  /**
   * Posición actual, siempre dentro de la lista: si la lista encoge (por
   * ejemplo, al despublicar un premio), no se queda apuntando a un hueco.
   */
  readonly indiceActivo = computed(() =>
    Math.min(this.indice(), Math.max(0, this.items().length - 1)),
  );

  /** Texto que se anuncia al cambiar de diapositiva. */
  readonly aviso = computed(
    () =>
      `${this.nombreElemento()} ${this.indiceActivo() + 1} de ${Math.max(
        1,
        this.items().length,
      )}`,
  );

  /** La diapositiva que se está viendo. */
  esActivo(indice: number): boolean {
    return this.indiceActivo() === indice;
  }

  /** Va al anterior dando la vuelta (del primero se pasa al último). */
  anterior(): void {
    if (!this.puedeNavegar()) return;
    this.irA(this.indiceActivo() - 1);
  }

  /** Va al siguiente dando la vuelta. */
  siguiente(): void {
    if (!this.puedeNavegar()) return;
    this.irA(this.indiceActivo() + 1);
  }

  irA(indice: number): void {
    const total = this.items().length;
    if (total === 0) return;
    // El módulo deja el índice siempre dentro de la lista, en las dos
    // direcciones: -1 es la última diapositiva.
    this.indice.set(((indice % total) + total) % total);
  }

  alternarPausa(): void {
    this.pausaManual.update((pausada) => !pausada);
  }

  pausarPorInteraccion(pausar: boolean): void {
    this.pausaPorInteraccion.set(pausar);
  }

  alPerderFoco(evento: FocusEvent): void {
    const contenedor = evento.currentTarget as HTMLElement | null;
    const destino = evento.relatedTarget as Node | null;
    if (!contenedor?.contains(destino)) this.pausaPorInteraccion.set(false);
  }

  /**
   * Flechas del teclado. El evento se escucha en el contenedor y sube desde
   * cualquier elemento que tenga el foco dentro del carrusel (los botones o el
   * enlace del certificado). Si el foco está en un campo de texto se deja
   * pasar: ahí las flechas sirven para moverse por el texto.
   */
  alTeclado(evento: KeyboardEvent): void {
    const etiqueta = (evento.target as HTMLElement | null)?.tagName?.toLowerCase();
    if (etiqueta === 'input' || etiqueta === 'textarea' || etiqueta === 'select') {
      return;
    }
    if (evento.key === 'ArrowLeft') {
      this.anterior();
    } else if (evento.key === 'ArrowRight') {
      this.siguiente();
    } else {
      return;
    }
    evento.preventDefault();
  }

  /** Deslizar con el dedo: en móvil, pasar de diapositiva es un gesto natural. */
  alTocarInicio(evento: TouchEvent): void {
    this.inicioToque = evento.touches[0]?.clientX ?? null;
  }

  alTocarFin(evento: TouchEvent): void {
    const inicio = this.inicioToque;
    this.inicioToque = null;
    if (inicio === null) return;

    const fin = evento.changedTouches[0]?.clientX ?? inicio;
    const recorrido = fin - inicio;
    if (Math.abs(recorrido) < DESLIZAMIENTO_MINIMO) return;

    // Se desliza hacia la izquierda para avanzar, como en cualquier carrusel.
    if (recorrido < 0) this.siguiente();
    else this.anterior();
  }
}
