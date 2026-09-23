import { Injectable, signal } from '@angular/core';

/** Un pendiente que la pantalla publica para el panel de notificaciones. */
export interface PendienteUi {
  /** Texto corto y claro. */
  titulo: string;
  /** Detalle en una línea (opcional). */
  detalle?: string;
  /** Ancla de la sección a la que lleva al pulsarlo. */
  ancla?: string;
  /** Color del punto: amarillo (aviso), verde (ok) o rojo (error). */
  tono?: 'aviso' | 'ok' | 'error';
}

/** Una clase espejo con chat, para el desplegable de mensajes. */
export interface ChatUi {
  /** Id del proyecto: al pulsarlo se abre su pantalla. */
  id: number;
  titulo: string;
  detalle?: string;
}

/**
 * Estado de interfaz compartido entre el esqueleto (barra superior y menú
 * lateral) y la pantalla que se muestra dentro.
 *
 * Existe porque el layout proyecta el contenido con `ng-content`, así que no
 * puede pasarle datos por `@Input`: la pantalla publica aquí lo que el layout
 * necesita (búsqueda, pendientes, conversaciones y contadores) y ambos leen las
 * mismas señales.
 */
@Injectable({ providedIn: 'root' })
export class UiStateService {
  /** Texto del buscador global de la barra superior. */
  readonly busqueda = signal('');

  /** Pendientes de la pantalla actual (campana de notificaciones). */
  readonly pendientes = signal<PendienteUi[]>([]);

  /** Clases espejo con chat disponibles desde la pantalla actual. */
  readonly chats = signal<ChatUi[]>([]);

  /** Contadores del menú lateral, por clave (por ejemplo `solicitudes`). */
  readonly contadores = signal<Record<string, number>>({});

  /**
   * La pantalla debe abrir el calendario. Lo pide el menú lateral, que no puede
   * llamar directamente a la pantalla porque el layout proyecta su contenido.
   */
  readonly abrirCalendario = signal(false);

  solicitarCalendario(): void {
    this.abrirCalendario.set(true);
  }

  /** La pantalla avisa de que ya abrió (o cerró) el calendario. */
  atenderCalendario(): void {
    this.abrirCalendario.set(false);
  }

  publicarPendientes(lista: PendienteUi[]): void {
    this.pendientes.set(lista);
  }

  publicarChats(lista: ChatUi[]): void {
    this.chats.set(lista);
  }

  publicarContadores(contadores: Record<string, number>): void {
    this.contadores.set(contadores);
  }

  /** Se llama al salir de una pantalla para no dejar datos de la anterior. */
  limpiarPantalla(): void {
    this.pendientes.set([]);
    this.chats.set([]);
    this.contadores.set({});
    this.busqueda.set('');
    this.abrirCalendario.set(false);
  }

  limpiarBusqueda(): void {
    this.busqueda.set('');
  }

  /**
   * ¿Alguno de estos campos coincide con lo escrito en el buscador?
   * Ignora mayúsculas y acentos, para que "colombia" encuentre "Colombia" y
   * "diseno" encuentre "diseño".
   */
  coincide(...campos: (string | number | null | undefined)[]): boolean {
    const consulta = normalizar(this.busqueda());
    if (!consulta) return true;
    return campos.some((campo) => normalizar(String(campo ?? '')).includes(consulta));
  }
}

/** Minúsculas y sin acentos, para comparar texto escrito por el usuario. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
