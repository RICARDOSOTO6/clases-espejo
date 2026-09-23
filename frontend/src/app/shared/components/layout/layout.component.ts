import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { UiStateService } from '../../../core/services/ui-state.service';
import { Perfil } from '../../../core/models/auth.models';
import { extraerMensajeError } from '../../../core/utils/http-error.util';
import { ModalComponent } from '../modal/modal.component';

/**
 * Iconos del esqueleto (trazo, misma familia Lucide que ya usa la aplicación).
 * Cada entrada es la lista de `d` que se pintan dentro del mismo `<svg>`.
 */
const ICONOS: Record<string, string[]> = {
  inicio: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  clases: [
    'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z',
    'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  ],
  solicitudes: [
    'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
    'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
    'M12 11h4',
    'M12 16h4',
    'M8 11h.01',
    'M8 16h.01',
  ],
  comunidad: [
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],
  institucion: [
    'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z',
    'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
    'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
    'M10 6h4',
    'M10 10h4',
    'M10 14h4',
    'M10 18h4',
  ],
  docentes: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  materias: [
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
    'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  ],
  perfil: ['M19 21a7 7 0 0 0-14 0', 'M12 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10z'],
  ayuda: [
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
    'M12 17h.01',
  ],
  salir: [
    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
    'm16 17 5-5-5-5',
    'M21 12H9',
  ],
  campana: [
    'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9',
    'M10.3 21a1.94 1.94 0 0 0 3.4 0',
  ],
  mensajes: [
    'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  ],
  buscar: ['M11 3a8 8 0 1 1 0 16 8 8 0 0 1 0-16z', 'm21 21-4.35-4.35'],
  calendario: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M21 6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z',
  ],
  cerrar: ['M18 6 6 18', 'm6 6 12 12'],
};

/** Un elemento del menú lateral. */
interface ItemNav {
  id: string;
  etiqueta: string;
  icono: string;
  /** Ruta a la que navega (para el inicio). */
  ruta?: string;
  /** Ancla de la sección de la pantalla a la que baja. */
  ancla?: string;
  /** Acción especial que no es navegar ni bajar: hoy solo el calendario. */
  accion?: 'calendario';
  /** Clave del contador que se muestra a la derecha. */
  contador?: string;
}

/** Panel desplegable abierto en la barra superior. */
type PanelAbierto = 'notificaciones' | 'mensajes' | 'usuario' | null;

/**
 * Esqueleto compartido de la aplicación: barra superior, menú lateral y el
 * contenido de cada pantalla proyectado con `<ng-content>`.
 */
@Component({
  selector: 'app-layout',
  imports: [RouterLink, ModalComponent],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly ui = inject(UiStateService);

  /** Nombre completo del usuario mostrado en la barra superior. */
  @Input() userName = '';
  /** Rol del usuario: condiciona el menú lateral. */
  @Input() rol: 'DOCENTE' | 'AGENTE' = 'DOCENTE';
  /** URL opcional de la bandera del país del usuario. */
  @Input() flagUrl: string | null = null;
  /** Texto alternativo de la bandera. */
  @Input() flagAlt = '';
  /** Ruta del panel, usada por el logo y por el elemento "Inicio". */
  @Input() homeRoute = '/docente';

  /** Se emite cuando el usuario pulsa "Cerrar sesión". */
  @Output() logout = new EventEmitter<void>();

  /** Estado del cajón lateral en pantallas pequeñas. */
  readonly sidebarOpen = signal(false);
  /** Desplegable abierto de la barra superior. */
  readonly panelAbierto = signal<PanelAbierto>(null);
  /** Último elemento del menú pulsado, para marcarlo como activo. */
  readonly seccionActiva = signal('inicio');

  readonly perfilAbierto = signal(false);
  readonly ayudaAbierta = signal(false);
  readonly perfil = signal<Perfil | null>(null);
  readonly cargandoPerfil = signal(false);
  readonly errorPerfil = signal<string | null>(null);

  /** Elementos del menú lateral según el rol. */
  readonly items = computed<ItemNav[]>(() =>
    this.rol === 'AGENTE'
      ? [
          { id: 'inicio', etiqueta: 'Inicio', icono: 'inicio', ruta: this.homeRoute },
          {
            id: 'calendario',
            etiqueta: 'Calendario',
            icono: 'calendario',
            accion: 'calendario',
            contador: 'urgencias',
          },
          {
            id: 'institucion',
            etiqueta: 'Mi institución',
            icono: 'institucion',
            ancla: 'institucion',
          },
          {
            id: 'docentes',
            etiqueta: 'Docentes',
            icono: 'docentes',
            ancla: 'docentes',
            contador: 'docentes',
          },
          {
            id: 'materias',
            etiqueta: 'Materias',
            icono: 'materias',
            ancla: 'materias',
            contador: 'materias',
          },
          {
            id: 'solicitudes',
            etiqueta: 'Solicitudes',
            icono: 'solicitudes',
            ancla: 'solicitudes',
            contador: 'solicitudes',
          },
          {
            id: 'proyectos',
            etiqueta: 'Clases espejo',
            icono: 'clases',
            ancla: 'proyectos',
            contador: 'proyectos',
          },
          { id: 'comunidad', etiqueta: 'Comunidad', icono: 'comunidad', ancla: 'comunidad' },
        ]
      : [
          { id: 'inicio', etiqueta: 'Inicio', icono: 'inicio', ruta: this.homeRoute },
          {
            id: 'calendario',
            etiqueta: 'Calendario',
            icono: 'calendario',
            accion: 'calendario',
            contador: 'urgencias',
          },
          {
            id: 'solicitudes',
            etiqueta: 'Mis solicitudes',
            icono: 'solicitudes',
            ancla: 'solicitudes',
            contador: 'solicitudes',
          },
          {
            id: 'proyectos',
            etiqueta: 'Mis clases espejo',
            icono: 'clases',
            ancla: 'proyectos',
            contador: 'proyectos',
          },
          { id: 'comunidad', etiqueta: 'Comunidad', icono: 'comunidad', ancla: 'comunidad' },
        ],
  );

  readonly iniciales = computed(() => {
    const partes = this.userName.trim().split(/\s+/).filter(Boolean);
    const nombre = partes[0]?.charAt(0) ?? '';
    const apellido = partes[1]?.charAt(0) ?? partes[2]?.charAt(0) ?? '';
    return (nombre + apellido).toUpperCase();
  });

  readonly rolEtiqueta = computed(() =>
    this.rol === 'AGENTE' ? 'Agente de internacionalización' : 'Docente',
  );

  /** Cuántos pendientes hay: se muestra como insignia en la campana. */
  readonly totalPendientes = computed(() => this.ui.pendientes().length);

  /** Institución del usuario, cuando el perfil ya se cargó. */
  readonly institucionPerfil = computed(() => {
    const p = this.perfil();
    if (!p) return null;
    return (
      p.agente?.institucion.nombre ??
      p.docente?.instituciones[0]?.institucion.nombre ??
      null
    );
  });

  readonly detallePerfil = computed<{ etiqueta: string; valor: string }[]>(() => {
    const p = this.perfil();
    if (!p) return [];
    const filas: { etiqueta: string; valor: string }[] = [];
    if (p.agente) {
      filas.push({ etiqueta: 'Cargo', valor: p.agente.cargo });
      filas.push({ etiqueta: 'Institución', valor: p.agente.institucion.nombre });
      filas.push({
        etiqueta: 'Ubicación',
        valor: [p.agente.institucion.ciudad, p.agente.institucion.pais]
          .filter(Boolean)
          .join(', '),
      });
    }
    if (p.docente) {
      filas.push({ etiqueta: 'Grado académico', valor: p.docente.gradoAcademico });
      filas.push({ etiqueta: 'Especialidad', valor: p.docente.especialidad });
      p.docente.instituciones.forEach((vinculo) => {
        filas.push({
          etiqueta: 'Institución',
          valor: `${vinculo.institucion.nombre} · No. empleado ${vinculo.numeroEmpleado}`,
        });
      });
    }
    return filas;
  });

  /** Trazos del icono, para pintarlos con `@for` dentro del `<svg>`. */
  trazos(nombre: string): string[] {
    return ICONOS[nombre] ?? ICONOS['inicio'];
  }

  /** Contador de un elemento del menú (0 = no se muestra). */
  contadorDe(item: ItemNav): number {
    if (!item.contador) return 0;
    return this.ui.contadores()[item.contador] ?? 0;
  }

  // --- Menú lateral ---

  alternarSidebar(): void {
    this.sidebarOpen.update((abierto) => !abierto);
  }

  cerrarSidebar(): void {
    this.sidebarOpen.set(false);
  }

  /**
   * Baja a la sección pedida. Si el usuario está en otra pantalla (por ejemplo
   * dentro de una clase espejo), primero vuelve al panel y después baja.
   */
  irA(item: ItemNav): void {
    this.cerrarSidebar();
    this.panelAbierto.set(null);
    this.seccionActiva.set(item.id);

    if (item.ruta) {
      void this.router.navigate([item.ruta]);
      return;
    }

    // El calendario es una ventana emergente: se le pide a la pantalla que la
    // abra, y si no estamos en el panel primero se vuelve a él.
    if (item.accion === 'calendario') {
      const enElPanel = this.router.url.split(/[?#]/)[0] === this.homeRoute;
      if (enElPanel) {
        this.ui.solicitarCalendario();
      } else {
        void this.router
          .navigate([this.homeRoute])
          .then(() => this.ui.solicitarCalendario());
      }
      return;
    }

    const ancla = item.ancla;
    if (!ancla) return;

    // Si la sección ya está en la pantalla actual (por ejemplo dentro de una
    // clase espejo), se baja directo; si no, se vuelve al panel y se baja.
    if (document.getElementById(ancla)) {
      this.bajarA(ancla);
      return;
    }
    void this.router.navigate([this.homeRoute], { fragment: ancla }).then(() => {
      // La pantalla puede tardar un instante en dibujarse: se reintenta.
      this.bajarA(ancla, 12);
    });
  }

  /** Baja a un ancla de la pantalla actual, esperando a que exista. */
  private bajarA(ancla: string, intentos = 4): void {
    const destino = document.getElementById(ancla);
    if (destino) {
      destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (intentos <= 0) return;
    setTimeout(() => this.bajarA(ancla, intentos - 1), 60);
  }

  /** Al pulsar un pendiente: cierra la campana y baja a su sección. */
  irAPendiente(pendiente: { ancla?: string }): void {
    this.panelAbierto.set(null);
    const ancla = pendiente.ancla;
    if (!ancla) return;
    this.seccionActiva.set(ancla);

    if (document.getElementById(ancla)) {
      this.bajarA(ancla);
      return;
    }
    void this.router.navigate([this.homeRoute], { fragment: ancla }).then(() => {
      this.bajarA(ancla, 12);
    });
  }

  /** Abre la clase espejo de una conversación (ahí vive el chat). */
  abrirChat(id: number): void {
    this.panelAbierto.set(null);
    this.cerrarSidebar();
    void this.router.navigate(['/proyectos', id]);
  }

  // --- Barra superior ---

  alternarPanel(panel: Exclude<PanelAbierto, null>): void {
    this.panelAbierto.update((actual) => (actual === panel ? null : panel));
  }

  cerrarPaneles(): void {
    this.panelAbierto.set(null);
  }

  alEscribirBusqueda(evento: Event): void {
    this.ui.busqueda.set((evento.target as HTMLInputElement).value);
  }

  limpiarBusqueda(): void {
    this.ui.limpiarBusqueda();
  }

  @HostListener('document:keydown.escape')
  alPulsarEscape(): void {
    this.panelAbierto.set(null);
    this.sidebarOpen.set(false);
  }

  // --- Perfil y ayuda ---

  abrirPerfil(): void {
    this.panelAbierto.set(null);
    this.cerrarSidebar();
    this.perfilAbierto.set(true);
    if (this.perfil() || this.cargandoPerfil()) return;

    this.cargandoPerfil.set(true);
    this.errorPerfil.set(null);
    this.auth.getPerfil().subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        this.cargandoPerfil.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorPerfil.set(extraerMensajeError(error, 'No se pudo cargar tu perfil'));
        this.cargandoPerfil.set(false);
      },
    });
  }

  cerrarPerfil(): void {
    this.perfilAbierto.set(false);
  }

  abrirAyuda(): void {
    this.panelAbierto.set(null);
    this.cerrarSidebar();
    this.ayudaAbierta.set(true);
  }

  cerrarAyuda(): void {
    this.ayudaAbierta.set(false);
  }

  cerrarSesion(): void {
    this.panelAbierto.set(null);
    this.logout.emit();
  }
}
