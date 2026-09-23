import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Esqueleto compartido de la aplicación (navbar + sidebar + contenido).
 * Sustituye a la topbar que estaba copiada en los paneles de docente, agente y
 * proyecto. El contenido de cada pantalla se proyecta con `<ng-content>`.
 */
@Component({
  selector: 'app-layout',
  imports: [RouterLink],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  /** Nombre completo del usuario mostrado en la navbar. */
  @Input() userName = '';
  /** Rol del usuario: condiciona el texto y la ruta de inicio. */
  @Input() rol: 'DOCENTE' | 'AGENTE' = 'DOCENTE';
  /** URL opcional de la bandera del país del usuario. */
  @Input() flagUrl: string | null = null;
  /** Texto alternativo de la bandera. */
  @Input() flagAlt = '';
  /** Ruta de inicio para el logo y el enlace "Inicio". */
  @Input() homeRoute = '/docente';
  /** Se emite cuando el usuario pulsa "Cerrar sesión" en la sidebar. */
  @Output() logout = new EventEmitter<void>();

  /** Estado del drawer en móvil. */
  sidebarOpen = false;

  get iniciales(): string {
    const partes = this.userName.trim().split(/\s+/).filter(Boolean);
    const nombre = partes[0]?.charAt(0) ?? '';
    const apellido = partes[1]?.charAt(0) ?? partes[2]?.charAt(0) ?? '';
    return (nombre + apellido).toUpperCase();
  }
}
