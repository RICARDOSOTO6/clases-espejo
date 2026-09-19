import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  viewChild,
} from '@angular/core';

/** Id único por instancia: evita ids duplicados si hay dos modales abiertos. */
let contadorModales = 0;

const SELECTOR_ENFOCABLES =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
})
export class ModalComponent implements AfterViewInit, OnDestroy {
  @Input() title = '';
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  /** En formularios conviene desactivarlo para no perder lo escrito. */
  @Input() cerrarConFondo = true;
  @Output() close = new EventEmitter<void>();

  readonly idTitulo = `modal-title-${++contadorModales}`;

  private readonly contenedor =
    viewChild<ElementRef<HTMLDivElement>>('contenedor');
  private elementoAnterior: HTMLElement | null = null;

  ngAfterViewInit(): void {
    // Recuerda dónde estaba el foco y lo mueve dentro del diálogo.
    this.elementoAnterior = document.activeElement as HTMLElement | null;
    this.enfocables()[0]?.focus();
  }

  ngOnDestroy(): void {
    // Al cerrar, el foco vuelve al disparador.
    this.elementoAnterior?.focus?.();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeModal();
  }

  @HostListener('document:keydown.tab', ['$event'])
  atraparFoco(evento: Event): void {
    const tecla = evento as KeyboardEvent;
    const focos = this.enfocables();
    if (focos.length === 0) return;

    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    const activo = document.activeElement as HTMLElement | null;

    if (tecla.shiftKey && activo === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!tecla.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  onBackdrop(): void {
    if (this.cerrarConFondo) this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }

  private enfocables(): HTMLElement[] {
    const el = this.contenedor()?.nativeElement;
    if (!el) return [];
    return Array.from(el.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES));
  }
}
