import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { CaceService } from './cace.service';
import {
  CacePublico,
  PaisBandera,
  Premio,
} from '../models/cace-identidad.models';
import {
  DESCRIPCION_CACE_POR_DEFECTO,
  LEMA_CACE_POR_DEFECTO,
  LOGO_CACE_POR_DEFECTO,
  PAISES_COMUNIDAD_POR_DEFECTO,
  TEMA_CACE_POR_DEFECTO,
  TemaCace,
} from '../constants/cace';
import { urlDeArchivo } from '../utils/url-archivo.util';

/**
 * Identidad pública de la CACE, compartida por toda la aplicación.
 *
 * La pide una sola vez el componente raíz y la deja en señales, porque la
 * necesitan cuatro sitios distintos: la portada del acceso (logo, lema y
 * premios), el panel del presidente, y las secciones «Comunidad» de docente y
 * agente (banderas y premios). También es quien **aplica el tema** al
 * documento.
 *
 * Todo tiene respaldo: si la configuración está vacía o la petición falla, se
 * devuelven el lema, la descripción, el logo y las banderas que ya había fijos
 * en el frontend, para que la aplicación se vea como siempre.
 */
@Injectable({ providedIn: 'root' })
export class IdentidadCaceService {
  private readonly cace = inject(CaceService);
  private readonly plataforma = inject(PLATFORM_ID);

  private readonly configuracion = signal<CacePublico | null>(null);
  private readonly listaPremios = signal<Premio[]>([]);

  /** Peticiones en curso, para no repetirlas en cada pantalla. */
  private peticionPublica$: Observable<CacePublico> | null = null;
  private peticionPremios$: Observable<Premio[]> | null = null;

  /** La configuración tal cual llegó (o `null` si todavía no se ha leído). */
  readonly publica = this.configuracion.asReadonly();

  /** Premios publicados, para la sección «Comunidad» y la portada. */
  readonly premios = this.listaPremios.asReadonly();

  /** Lema de la CACE, con el texto de siempre como respaldo. */
  readonly lema = computed(
    () => this.configuracion()?.lema?.trim() || LEMA_CACE_POR_DEFECTO,
  );

  /** Nombre o descripción de la comunidad, también con respaldo. */
  readonly descripcion = computed(
    () =>
      this.configuracion()?.descripcion?.trim() || DESCRIPCION_CACE_POR_DEFECTO,
  );

  /**
   * URL del logo lista para un `<img>`: el de la CACE si lo hay y, si no, el
   * logo del proyecto que ya venía con la aplicación.
   */
  readonly logo = computed(
    () => urlDeArchivo(this.configuracion()?.logoUrl) ?? LOGO_CACE_POR_DEFECTO,
  );

  readonly tema = computed<TemaCace>(
    () => this.configuracion()?.tema ?? TEMA_CACE_POR_DEFECTO,
  );

  /**
   * Banderas de la comunidad, ya ordenadas y solo las activas (lo hace el
   * servidor). Si la tabla estuviera vacía se usa la lista de respaldo: una
   * sección «Comunidad» en blanco parecería un error de la aplicación.
   */
  readonly paises = computed<PaisBandera[]>(() => {
    const paises = this.configuracion()?.paises ?? [];
    return paises.length > 0 ? paises : PAISES_COMUNIDAD_POR_DEFECTO;
  });

  /**
   * Pide la configuración pública (una sola vez salvo que se fuerce) y aplica
   * el tema al documento en cuanto llega.
   */
  cargar(forzar = false): Observable<CacePublico> {
    if (forzar) this.peticionPublica$ = null;

    if (!this.peticionPublica$) {
      this.peticionPublica$ = this.cace.obtenerPublico().pipe(
        tap({
          next: (config) => {
            this.configuracion.set(config);
            this.aplicarTema(config.tema);
          },
          // Si falla se olvida la petición: así el siguiente intento vuelve a
          // preguntar en lugar de quedarse con el error para siempre.
          error: () => {
            this.peticionPublica$ = null;
          },
        }),
        shareReplay(1),
      );
    }
    return this.peticionPublica$;
  }

  /** Pide los premios publicados (una sola vez, con el mismo criterio). */
  cargarPremios(forzar = false): Observable<Premio[]> {
    if (forzar) this.peticionPremios$ = null;

    if (!this.peticionPremios$) {
      this.peticionPremios$ = this.cace.premiosPublicos().pipe(
        tap({
          next: (premios) => this.listaPremios.set(premios),
          // Igual que arriba: si falla, el error no se queda cacheado.
          error: () => {
            this.peticionPremios$ = null;
          },
        }),
        shareReplay(1),
      );
    }
    return this.peticionPremios$;
  }

  /**
   * Pinta el tema en el elemento raíz. Se comprueba la plataforma porque el
   * proyecto se compila también para el servidor, donde no hay `document`.
   */
  private aplicarTema(tema: TemaCace): void {
    if (!isPlatformBrowser(this.plataforma)) return;
    document.documentElement.setAttribute('data-tema', tema);
  }
}
