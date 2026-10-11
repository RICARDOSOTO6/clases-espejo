import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdentidadCaceService } from './core/services/identidad-cace.service';

/**
 * Componente raíz.
 *
 * Aprovecha para pedir **una sola vez** la identidad pública de la CACE: de ahí
 * salen el tema (que se aplica al documento), el logo, el lema y las banderas.
 * Se hace aquí, y no en cada pantalla, porque la necesitan la portada del
 * acceso —que se ve antes de iniciar sesión—, el panel de la presidencia y las
 * pantallas de docente y agente.
 *
 * Si la petición falla no pasa nada: el servicio devuelve los textos, el logo y
 * las banderas de respaldo y la aplicación se ve como siempre.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly identidad = inject(IdentidadCaceService);

  constructor() {
    this.identidad.cargar().subscribe({ error: () => {} });
  }
}
