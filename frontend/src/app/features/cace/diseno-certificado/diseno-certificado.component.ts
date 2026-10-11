import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import {
  BorradorPlantillaCertificado,
  CampoCertificado,
  CatalogoCampoCertificado,
  ClaveCampoCertificado,
  PlantillaCertificado,
  ProblemaPlantilla,
} from '../../../core/models/certificado.models';
import { PlantillaCertificadoService } from '../../../core/services/plantilla-certificado.service';
import { fechaHoraLarga } from '../../../core/utils/fecha.util';
import {
  ALINEACIONES,
  ANCHO_PT,
  LIENZO_POR_DEFECTO,
  LienzoPlantilla,
  TAMANO_MAXIMO,
  TAMANO_MINIMO,
  TAMANO_MINIMO_NOMBRE,
  TIPOGRAFIAS,
  TipografiaCertificado,
  aHex,
  ajustarNombre,
  encajarCaja,
  esColor,
  estiloDeTipografia,
  revisarPlantilla,
  tipografiaDe,
} from '../../../core/utils/certificado-medidas';

/**
 * El nombre largo de ejemplo que se prueba cuando no hay ninguna lista de la
 * que sacar el nombre más largo de la clase. Lleva acentos a propósito: es el
 * caso que rompe un certificado mal medido.
 */
const NOMBRE_LARGO_EJEMPLO = 'María Fernanda de Jesús Gutiérrez Villanueva';

/** Folio de ejemplo para la vista previa: el mismo formato que los de verdad. */
const FOLIO_EJEMPLO = 'CACE-2026-0001';

/** Las claves de los tres huecos, para recorrerlas sin depender del catálogo. */
const CLAVES: ClaveCampoCertificado[] = ['nombre', 'folio', 'qr'];

/** Una caja tal como se pinta en el lienzo. */
interface CajaLienzo {
  clave: ClaveCampoCertificado;
  etiqueta: string;
  caja: CampoCertificado;
  /** Lo que se escribe dentro (vacío para el QR). */
  texto: string;
  /** El QR no lleva tipografía: no se le ofrecen letra, color ni alineación. */
  esTexto: boolean;
  /** Tamaño de letra con el que sale de verdad (el del autoajuste, si es el nombre). */
  tamano: number;
}

/** Un rectángulo en píxeles de la plantilla. */
interface Rectangulo {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Cómo de sano está un dato del diseño: verde, amarillo o rojo. */
type EstadoSalud = 'ok' | 'aviso' | 'grave';

/** Una línea del panel «Salud del diseño»: un dato y lo que arrastra. */
interface SaludDiseno {
  clave: string;
  etiqueta: string;
  estado: EstadoSalud;
  problemas: ProblemaPlantilla[];
}

/**
 * El nombre con el que la revisión llama al conjunto del diseño (falta la
 * imagen, la proporción no es la del A4, sale pixelada…). Tiene que coincidir
 * con el que usa `revisarPlantilla`.
 */
const DISENO = 'Diseño';

/** El peor estado de una lista de problemas: manda lo grave. */
function estadoDe(problemas: ProblemaPlantilla[]): EstadoSalud {
  if (problemas.some((p) => p.gravedad === 'grave')) return 'grave';
  return problemas.length > 0 ? 'aviso' : 'ok';
}

/**
 * El panel de diseño del certificado: se sube la **imagen terminada** y se
 * marcan encima los **tres huecos** que rellena la aplicación.
 *
 * Tres ideas sostienen todo lo demás:
 *
 * 1. **El diseño se hace fuera.** Aquí no se dibujan logos, títulos ni firmas:
 *    todo eso viene dentro de la imagen. Lo único que se coloca son los tres
 *    datos que cambian (nombre, folio y QR).
 * 2. **Los huecos se marcan arrastrando**, como cuando se recorta una foto: se
 *    elige qué hueco se va a marcar y se dibuja su rectángulo sobre la vista
 *    previa. Después se puede mover y redimensionar.
 * 3. **La vista previa no miente.** El nombre se enseña con el **mismo
 *    autoajuste** que usa el PDF, el folio con su tamaño real y el QR de verdad
 *    (lo genera el servidor), sobre la imagen recortada igual que se imprime.
 *
 * El componente no habla con el servidor para guardar: recibe el borrador y
 * avisa de los cambios, para que la pantalla que lo usa siga siendo la dueña
 * del guardado. Lo mismo con las versiones: se pintan aquí (es donde se miran),
 * pero las pide y las activa la pantalla, que las recibe por `input` y las pide
 * por `output`.
 *
 * Se presenta en **tres columnas**: herramientas y versiones a la izquierda, la
 * hoja en el centro y las propiedades (con la vista previa y la salud del
 * diseño) a la derecha. Eso es solo la presentación: los huecos se siguen
 * marcando arrastrando, el nombre se sigue ajustando solo y guardar sigue
 * creando una versión nueva.
 */
@Component({
  selector: 'app-diseno-certificado',
  templateUrl: './diseno-certificado.component.html',
  styleUrl: './diseno-certificado.component.css',
})
export class DisenoCertificadoComponent {
  /** El borrador que se está editando (lo lleva la pantalla de la CACE). */
  readonly borrador = input.required<BorradorPlantillaCertificado>();
  /** URL de la imagen del diseño ya resuelta, para pintarla en el lienzo. */
  readonly fondo = input<string | null>(null);
  /** Etiquetas del catálogo, en su orden. */
  readonly catalogo = input<CatalogoCampoCertificado[]>([]);
  /** Mientras el servidor guarda, los botones se quedan quietos. */
  readonly guardando = input(false);
  /**
   * Los nombres reales de la clase, para poder probar con el más largo. Hoy la
   * presidencia no tiene acceso a las listas de los docentes (son suyas), así
   * que llega vacío y se usa un nombre largo de ejemplo.
   */
  readonly nombresDeClase = input<string[]>([]);
  /**
   * Las versiones guardadas. Se enseñan (y se activan) desde esta misma
   * columna de herramientas; quien las pide y las activa sigue siendo la
   * pantalla, que es la dueña de los datos.
   */
  readonly versiones = input<PlantillaCertificado[]>([]);
  /** Los dos archivos de apoyo del diseño, ya resueltos a URL. */
  readonly urlZonas = input<string | null>(null);
  readonly urlGuia = input<string | null>(null);
  /** Mientras el servidor relee la plantilla, «Actualizar» se queda quieto. */
  readonly actualizando = input(false);
  /** Versión cuyo «Activar» está en curso (`null` si ninguna). */
  readonly activando = input<number | null>(null);
  /** Versión cuyo borrado está en curso (`null` si ninguno). */
  readonly borrando = input<number | null>(null);
  /** Mientras se sube la imagen del diseño. */
  readonly subiendoFondo = input(false);

  readonly cambio = output<Partial<BorradorPlantillaCertificado>>();
  readonly guardar = output<void>();
  /** «Restaurar los huecos de la guía»: lo aplica la pantalla. */
  readonly restaurar = output<void>();
  /** «Actualizar»: vuelve a pedir la plantilla al servidor. */
  readonly actualizar = output<void>();
  /** «Ver» una versión guardada en el panel. */
  readonly verVersion = output<PlantillaCertificado>();
  /** «Activar» una versión guardada. */
  readonly activarVersion = output<PlantillaCertificado>();
  /** «Borrar» una versión suelta, ya confirmada. La petición la hace la pantalla. */
  readonly borrarVersion = output<PlantillaCertificado>();
  /** La imagen del diseño elegida: la sube la pantalla. */
  readonly subirFondo = output<File>();

  private readonly plantilla = inject(PlantillaCertificadoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly marco = viewChild<ElementRef<HTMLDivElement>>('marco');

  // --- Estado de la edición ---

  /** Hueco cuyos controles se están enseñando. */
  readonly seleccion = signal<ClaveCampoCertificado | null>('nombre');
  /** Hueco que se está marcando ahora mismo (mientras se dibuja el rectángulo). */
  readonly marcando = signal<ClaveCampoCertificado | null>(null);
  /** Rectángulo que se está dibujando, para verlo mientras se arrastra. */
  readonly rectangulo = signal<Rectangulo | null>(null);
  /** Versión cuyo borrado se está confirmando (el borrado no se deshace). */
  readonly versionAConfirmar = signal<number | null>(null);

  /** Datos de la vista previa: no se guardan, solo sirven para ver y medir. */
  readonly nombrePrueba = signal(NOMBRE_LARGO_EJEMPLO);
  readonly folioPrueba = signal(FOLIO_EJEMPLO);

  /**
   * El zoom del lienzo: `1` es el ancho de la columna. Se queda entre el 50 %
   * (para ver el diseño entero de un vistazo) y el 200 % (para colocar un hueco
   * fino sin pelearse con el ratón).
   */
  readonly zoom = signal(1);
  readonly zoomMinimo = 0.5;
  readonly zoomMaximo = 2;
  readonly pasoZoom = 0.25;

  /** La imagen del QR del folio de prueba, ya generada por el servidor. */
  readonly qrUrl = signal<string | null>(null);

  /** Lo que se pudo leer de la imagen del diseño. */
  readonly proporcionFondo = signal<number | null>(null);
  readonly resolucionFondo = signal<{ anchoPx: number; altoPx: number } | null>(null);
  private readonly fondosMuestreados = signal<
    Partial<Record<ClaveCampoCertificado, string>>
  >({});

  /** Lienzo reducido del diseño, para poder leer el color de debajo de un hueco. */
  private lona: HTMLCanvasElement | null = null;
  private imagenDiseno: HTMLImageElement | null = null;

  readonly alineaciones = ALINEACIONES;
  readonly tipografias = TIPOGRAFIAS;
  readonly tamanoMinimo = TAMANO_MINIMO;
  readonly tamanoMaximo = TAMANO_MAXIMO;
  readonly minimoLegible = TAMANO_MINIMO_NOMBRE;
  readonly lienzoPorDefecto = LIENZO_POR_DEFECTO;

  constructor() {
    // Al cambiar de versión se empieza de cero y la vista previa vuelve a los
    // ejemplos con los que se diseñó esa versión.
    let ultimaClave = '';
    effect(() => {
      const b = this.borrador();
      const clave = `${b.id ?? 0}-${b.version}`;
      if (clave === ultimaClave) return;
      ultimaClave = clave;
      this.nombrePrueba.set(b.campos.nombre?.muestra?.trim() || NOMBRE_LARGO_EJEMPLO);
      this.folioPrueba.set(b.campos.folio?.muestra?.trim() || FOLIO_EJEMPLO);
      this.seleccion.set('nombre');
      this.marcando.set(null);
      this.rectangulo.set(null);
    });

    // El QR de la vista previa se pide al servidor: es el mismo código que sale
    // impreso, no un dibujo de mentira.
    toObservable(this.folioPrueba)
      .pipe(
        switchMap((folio) =>
          this.plantilla.qrDeFolio(folio.trim() || FOLIO_EJEMPLO).pipe(
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((blob) => {
        const anterior = this.qrUrl();
        if (anterior) URL.revokeObjectURL(anterior);
        this.qrUrl.set(blob ? URL.createObjectURL(blob) : null);
      });

    // Al cambiar los huecos hay que volver a mirar qué hay detrás de cada uno
    // (el contraste depende de dónde esté la caja, no solo del diseño).
    effect(() => {
      this.borrador();
      this.muestrear();
    });

    this.destroyRef.onDestroy(() => {
      const url = this.qrUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }

  // --- Lo que se pinta ---

  readonly lienzo = computed<LienzoPlantilla>(() => {
    const b = this.borrador();
    return { anchoPx: b.anchoPx, altoPx: b.altoPx };
  });

  /** El nombre de prueba tal como lo va a dejar el autoajuste. */
  readonly ajusteNombre = computed(() => {
    const campo = this.borrador().campos.nombre;
    if (!campo) return { lineas: [] as string[], tamano: TAMANO_MINIMO_NOMBRE, desborda: false };
    return ajustarNombre(this.nombrePrueba(), campo, this.lienzo());
  });

  /** Los tres huecos, listos para el lienzo. */
  readonly cajas = computed<CajaLienzo[]>(() => {
    const b = this.borrador();
    const ajuste = this.ajusteNombre();
    const salida: CajaLienzo[] = [];

    for (const entrada of this.catalogo()) {
      const caja = b.campos[entrada.clave];
      if (!caja) continue;
      const esQR = entrada.clave === 'qr';
      salida.push({
        clave: entrada.clave,
        etiqueta: entrada.etiqueta,
        caja,
        texto: esQR
          ? ''
          : entrada.clave === 'nombre'
            ? ajuste.lineas.join('\n')
            : this.folioPrueba(),
        esTexto: !esQR,
        tamano: entrada.clave === 'nombre' ? ajuste.tamano : caja.tamano,
      });
    }
    return salida;
  });

  /** La caja seleccionada (o `null`). Los controles enseñan y cambian sus valores. */
  readonly seleccionada = computed<CajaLienzo | null>(() => {
    const clave = this.seleccion();
    if (!clave) return null;
    return this.cajas().find((c) => c.clave === clave) ?? null;
  });

  /** La tipografía de la caja seleccionada, para el desplegable corto. */
  readonly tipografiaSeleccionada = computed<TipografiaCertificado>(() => {
    const item = this.seleccionada();
    return item ? tipografiaDe(item.caja) : 'normal';
  });

  /** El nombre más largo que se puede probar: el de la clase o el de ejemplo. */
  readonly nombreLargoDisponible = computed(() => {
    const nombres = this.nombresDeClase().filter((n) => n?.trim());
    if (nombres.length === 0) return NOMBRE_LARGO_EJEMPLO;
    return nombres.reduce((largo, nombre) =>
      nombre.trim().length > largo.trim().length ? nombre : largo,
    );
  });

  /** Si el nombre largo de prueba sale de una lista real o del ejemplo. */
  readonly nombreLargoEsDeLaClase = computed(
    () => this.nombresDeClase().filter((n) => n?.trim()).length > 0,
  );

  /**
   * Los problemas del diseño: los **graves** bloquean guardar y los avisos solo
   * se enseñan. Se calculan con el nombre de prueba que está a la vista, que es
   * el caso que se quiere comprobar.
   */
  readonly problemas = computed(() =>
    revisarPlantilla({
      campos: this.borrador().campos,
      lienzo: this.lienzo(),
      proporcionFondo: this.proporcionFondo(),
      resolucionFondo: this.resolucionFondo(),
      hayFondo: !!this.borrador().fondoUrl,
      nombrePrueba: this.nombrePrueba(),
      fondosMuestreados: this.fondosMuestreados(),
      etiquetas: this.catalogo(),
    }),
  );

  readonly graves = computed(() => this.problemas().filter((p) => p.gravedad === 'grave'));
  readonly avisos = computed(() => this.problemas().filter((p) => p.gravedad === 'aviso'));
  readonly puedeGuardar = computed(() => !this.guardando() && this.graves().length === 0);

  /**
   * La salud del diseño, dato a dato: un check verde, un aviso amarillo o una
   * cruz roja por cada hueco, más el conjunto del diseño. Es la revisión
   * contada como se mira un semáforo, no como se lee un párrafo.
   */
  readonly salud = computed<SaludDiseno[]>(() => {
    const problemas = this.problemas();
    const salida: SaludDiseno[] = [];
    for (const { clave, etiqueta } of this.catalogo()) {
      const suyos = problemas.filter((p) => p.donde === etiqueta);
      salida.push({ clave, etiqueta, estado: estadoDe(suyos), problemas: suyos });
    }
    const delDiseno = problemas.filter((p) => p.donde === DISENO);
    salida.push({
      clave: 'diseno',
      etiqueta: DISENO,
      estado: estadoDe(delDiseno),
      problemas: delDiseno,
    });
    return salida;
  });

  /** El estado de un hueco concreto, para el aviso que va a su lado. */
  estadoDeCampo(clave: ClaveCampoCertificado): EstadoSalud {
    const etiqueta = this.catalogo().find((c) => c.clave === clave)?.etiqueta;
    if (!etiqueta) return 'ok';
    return estadoDe(this.problemas().filter((p) => p.donde === etiqueta));
  }

  /** El estado del conjunto: manda lo grave, después los avisos. */
  readonly estadoGeneral = computed<EstadoSalud>(() => {
    if (this.graves().length > 0) return 'grave';
    return this.avisos().length > 0 ? 'aviso' : 'ok';
  });

  /** El zoom en porcentaje, tal como se enseña al lado de los botones. */
  readonly zoomEnPorcentaje = computed(() => Math.round(this.zoom() * 100));
  readonly puedeAcercar = computed(() => this.zoom() < this.zoomMaximo);
  readonly puedeAlejar = computed(() => this.zoom() > this.zoomMinimo);

  /**
   * El símbolo de un estado: check verde, aviso amarillo o cruz roja. Es
   * decorativo (el texto del aviso va al lado), pero es lo que hace que la
   * revisión se lea de un vistazo.
   */
  iconoDe(estado: EstadoSalud): string {
    if (estado === 'grave') return '✕';
    return estado === 'aviso' ? '⚠' : '✓';
  }

  // --- La versión guardada ---

  /**
   * Los problemas graves de cada versión guardada, calculados **una vez** por
   * lista: la tabla los pregunta tres veces por fila (el aviso, el `title` del
   * botón y si se puede activar) y medir el nombre no es gratis.
   */
  private readonly gravesPorVersion = computed(() => {
    const salida = new Map<number, ProblemaPlantilla[]>();
    for (const version of this.versiones()) {
      salida.set(
        version.id,
        revisarPlantilla({
          campos: version.campos,
          lienzo: { anchoPx: version.anchoPx, altoPx: version.altoPx },
          proporcionFondo: null,
          resolucionFondo: null,
          hayFondo: !!version.fondoUrl,
          nombrePrueba: version.campos.nombre?.muestra ?? '',
          fondosMuestreados: {},
          etiquetas: this.catalogo(),
        }).filter((p) => p.gravedad === 'grave'),
      );
    }
    return salida;
  });

  /** Lo que impide activar una versión guardada (vacío si se puede). */
  gravesDeVersion(version: PlantillaCertificado): ProblemaPlantilla[] {
    return this.gravesPorVersion().get(version.id) ?? [];
  }

  /** Por qué no se puede activar esa versión, en una línea. */
  motivoGraveDeVersion(version: PlantillaCertificado): string {
    return this.gravesDeVersion(version)
      .map((p) => `${p.donde}: ${p.mensaje}`)
      .join(' ');
  }

  /**
   * Por qué **no** se puede borrar una versión (vacío si sí se puede).
   *
   * Son las dos reglas del servidor, dichas antes de pulsar: la versión activa
   * es la que se usa al emitir (hay que activar otra primero) y una versión con
   * certificados emitidos no se toca, porque los certificados son inmutables y
   * apuntan a su diseño.
   */
  motivoNoBorrar(version: PlantillaCertificado): string {
    if (version.activa) {
      return 'Es la versión activa: activa antes otra versión y vuelve a intentarlo.';
    }
    if (version.certificados > 0) {
      return `No se puede borrar: ${version.certificados} ${
        version.certificados === 1 ? 'certificado se emitió' : 'certificados se emitieron'
      } con esta versión.`;
    }
    return '';
  }

  /** El botón de borrar solo se habilita cuando de verdad se puede borrar. */
  puedeBorrar(version: PlantillaCertificado): boolean {
    return this.motivoNoBorrar(version) === '';
  }

  /** El borrado no se deshace: se confirma dentro de la propia fila. */
  pedirBorrar(version: PlantillaCertificado): void {
    if (!this.puedeBorrar(version)) return;
    this.versionAConfirmar.set(version.id);
  }

  cancelarBorrar(): void {
    this.versionAConfirmar.set(null);
  }

  confirmarBorrar(version: PlantillaCertificado): void {
    this.versionAConfirmar.set(null);
    this.borrarVersion.emit(version);
  }

  /**
   * Quién creó la versión y cuándo, para el `title` de la fila: es lo que hace
   * falta para auditar sin repetir esa línea en todas las versiones de la tabla.
   */
  auditoriaDe(version: PlantillaCertificado): string {
    const quien = version.creadaPor ? `Creada por ${version.creadaPor}` : 'Creada';
    const cuando = version.creadoEn ? ` el ${fechaHoraLarga(version.creadoEn)}` : '';
    return `${quien}${cuando} · ${version.anchoPx} × ${version.altoPx} px`;
  }

  // --- Posiciones en el DOM ---

  /** Posición o tamaño en porcentaje del papel (lo mismo que hace el PDF). */
  porcentaje(valor: number, lado: 'x' | 'y'): string {
    const lienzo = this.lienzo();
    const total = lado === 'y' ? lienzo.altoPx : lienzo.anchoPx;
    return `${(valor / total) * 100}%`;
  }

  /**
   * Tamaño de letra en `cqw`: relativo al ancho del lienzo, que es la misma
   * proporción que usa el PDF (el ancho de la hoja son `ANCHO_PT` puntos).
   */
  tamanoEnCqw(tamano: number): string {
    return `${(tamano / ANCHO_PT) * 100}cqw`;
  }

  esSeleccionada(clave: ClaveCampoCertificado): boolean {
    return this.seleccion() === clave;
  }

  // --- Marcar los huecos ---

  /** Empieza a marcar un hueco: el siguiente arrastre sobre el lienzo lo dibuja. */
  marcar(clave: ClaveCampoCertificado): void {
    this.marcando.set(this.marcando() === clave ? null : clave);
    this.seleccion.set(clave);
  }

  cancelarMarcado(): void {
    this.marcando.set(null);
    this.rectangulo.set(null);
  }

  /**
   * Arrastre sobre el lienzo: dibuja el rectángulo del hueco que se está
   * marcando, como cuando se recorta una foto. Un clic suelto (sin arrastrar)
   * no marca nada: hace falta dibujar el hueco.
   */
  alPulsarLienzo(evento: PointerEvent): void {
    const clave = this.marcando();
    if (!clave || evento.button !== 0) return;
    const inicio = this.aCoordenadas(evento);
    if (!inicio) return;

    evento.preventDefault();
    const origenX = inicio.x;
    const origenY = inicio.y;
    this.rectangulo.set({ x: origenX, y: origenY, ancho: 0, alto: 0 });

    const mover = (movimiento: PointerEvent) => {
      const punto = this.aCoordenadas(movimiento);
      if (!punto) return;
      this.rectangulo.set(rectanguloEntre(origenX, origenY, punto.x, punto.y));
    };

    const soltar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);

      const dibujado = this.rectangulo();
      this.rectangulo.set(null);
      this.marcando.set(null);
      if (!dibujado || dibujado.ancho < 40 || dibujado.alto < 20) return;

      this.aplicarCaja(clave, encajarCaja(dibujado, this.lienzo()));
    };

    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
  }

  // --- Mover y redimensionar ---

  /**
   * Arrastre de un hueco para moverlo. Mientras se está marcando otro hueco el
   * gesto no mueve nada: el evento sigue subiendo al lienzo, que es quien
   * dibuja el rectángulo nuevo.
   */
  arrastrar(evento: PointerEvent, clave: ClaveCampoCertificado): void {
    if (this.marcando() || evento.button !== 0) return;
    const item = this.cajas().find((c) => c.clave === clave);
    const marco = this.marco()?.nativeElement;
    if (!item || !marco) return;

    evento.preventDefault();
    evento.stopPropagation();
    this.seleccion.set(clave);

    const escala = this.escala(marco);
    const inicioX = evento.clientX;
    const inicioY = evento.clientY;
    const origen = { x: item.caja.x, y: item.caja.y };

    const mover = (movimiento: PointerEvent) => {
      const dx = (movimiento.clientX - inicioX) / escala;
      const dy = (movimiento.clientY - inicioY) / escala;
      this.aplicarCaja(
        clave,
        encajarCaja({ ...item.caja, x: origen.x + dx, y: origen.y + dy }, this.lienzo()),
      );
    };

    this.escuchar(mover);
  }

  /** Redimensión desde la esquina inferior derecha: se mueve ese lado. */
  redimensionar(evento: PointerEvent, clave: ClaveCampoCertificado): void {
    if (this.marcando() || evento.button !== 0) return;
    const item = this.cajas().find((c) => c.clave === clave);
    const marco = this.marco()?.nativeElement;
    if (!item || !marco) return;

    evento.preventDefault();
    evento.stopPropagation();
    this.seleccion.set(clave);

    const escala = this.escala(marco);
    const inicioX = evento.clientX;
    const inicioY = evento.clientY;
    const original = { ancho: item.caja.ancho, alto: item.caja.alto };

    const mover = (movimiento: PointerEvent) => {
      const dx = (movimiento.clientX - inicioX) / escala;
      const dy = (movimiento.clientY - inicioY) / escala;
      this.aplicarCaja(
        clave,
        encajarCaja(
          {
            ...item.caja,
            ancho: original.ancho + dx,
            alto: original.alto + dy,
          },
          this.lienzo(),
        ),
      );
    };

    this.escuchar(mover);
  }

  /** Escucha el gesto en el documento, para que no se corte al salir de la caja. */
  private escuchar(mover: (evento: PointerEvent) => void): void {
    const soltar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
    };
    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
  }

  // --- Controles de estilo ---

  cambiarTipografia(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value as TipografiaCertificado;
    this.cambiarEstilo(estiloDeTipografia(valor));
  }

  cambiarAlineacion(alineacion: 'left' | 'center' | 'right'): void {
    this.cambiarEstilo({ alineacion });
  }

  cambiarColor(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    if (esColor(valor)) this.cambiarEstilo({ color: valor });
  }

  /** El tamaño de partida (el máximo del autoajuste del nombre). */
  cambiarTamano(evento: Event, cual: 'maximo' | 'minimo'): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    if (!Number.isFinite(valor)) return;
    const item = this.seleccionada();
    if (!item) return;

    const redondeado = Math.min(
      TAMANO_MAXIMO,
      Math.max(TAMANO_MINIMO, Math.round(valor)),
    );
    if (cual === 'maximo') {
      this.cambiarEstilo({
        tamano: redondeado,
        // El suelo nunca puede quedar por encima del techo.
        tamanoMinimo: Math.min(item.caja.tamanoMinimo, redondeado),
      });
      return;
    }
    this.cambiarEstilo({ tamanoMinimo: Math.min(redondeado, item.caja.tamano) });
  }

  cambiarNombrePrueba(valor: string): void {
    this.nombrePrueba.set(valor);
  }

  cambiarFolioPrueba(valor: string): void {
    this.folioPrueba.set(valor);
  }

  /**
   * Prueba con el nombre más largo de la clase (o con un nombre largo de
   * ejemplo, si no hay ninguna lista a mano).
   */
  probarNombreLargo(): void {
    this.nombrePrueba.set(this.nombreLargoDisponible());
  }

  guardarPlantilla(): void {
    if (!this.puedeGuardar()) return;
    this.guardar.emit();
  }

  /** Vuelve a los tres huecos que manda la guía de diseño. */
  restaurarHuecos(): void {
    this.restaurar.emit();
  }

  // --- Zoom ---

  /** Acerca o aleja el lienzo. El paso va en tanto por uno (`-0.25`, `+0.25`). */
  cambiarZoom(paso: number): void {
    const siguiente = Math.round((this.zoom() + paso) * 100) / 100;
    this.zoom.set(Math.min(this.zoomMaximo, Math.max(this.zoomMinimo, siguiente)));
  }

  /** Vuelve al 100 %: el lienzo, ajustado al ancho de la columna. */
  ajustarZoom(): void {
    this.zoom.set(1);
  }

  // --- La imagen del diseño ---

  /**
   * El archivo elegido. La subida la hace la pantalla (es la dueña de la
   * petición); aquí solo se avisa y se deja el campo listo para volver a elegir
   * el mismo archivo después de un error.
   */
  alElegirFondo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (archivo) this.subirFondo.emit(archivo);
  }

  // --- La imagen del diseño ---

  /** Se midió la imagen: se apunta su tamaño y qué hay detrás de cada hueco. */
  alCargarDiseno(evento: Event): void {
    const imagen = evento.target as HTMLImageElement;
    this.imagenDiseno = imagen;
    this.resolucionFondo.set({
      anchoPx: imagen.naturalWidth,
      altoPx: imagen.naturalHeight,
    });
    this.proporcionFondo.set(
      imagen.naturalHeight ? imagen.naturalWidth / imagen.naturalHeight : null,
    );
    this.lona = imagenAManchaReducida(imagen);
    this.muestrear();
  }

  /**
   * El color medio del diseño debajo de cada hueco, leído de un lienzo pequeño.
   *
   * Se tiene en cuenta el **recorte**: la imagen se escala hasta tapar la hoja y
   * se recorta por el centro, así que un hueco no cae sobre el mismo trozo de
   * imagen que sus coordenadas. Si el navegador no deja leer los píxeles (imagen
   * de otro origen sin permiso), simplemente no hay aviso de contraste.
   */
  private muestrear(): void {
    const lona = this.lona;
    const imagen = this.imagenDiseno;
    if (!lona || !imagen || !imagen.naturalWidth) {
      this.fondosMuestreados.set({});
      return;
    }
    const contexto = lona.getContext('2d', { willReadFrequently: true });
    if (!contexto) return;

    const lienzo = this.lienzo();
    const escala = Math.max(
      lienzo.anchoPx / imagen.naturalWidth,
      lienzo.altoPx / imagen.naturalHeight,
    );
    const desplazamientoX = (lienzo.anchoPx - imagen.naturalWidth * escala) / 2;
    const desplazamientoY = (lienzo.altoPx - imagen.naturalHeight * escala) / 2;
    const k = lona.width / imagen.naturalWidth;

    const salida: Partial<Record<ClaveCampoCertificado, string>> = {};
    try {
      for (const clave of CLAVES) {
        const caja = this.borrador().campos[clave];
        if (!caja) continue;
        const x = Math.max(0, Math.floor(((caja.x - desplazamientoX) / escala) * k));
        const y = Math.max(0, Math.floor(((caja.y - desplazamientoY) / escala) * k));
        const ancho = Math.max(1, Math.min(lona.width - x, Math.round((caja.ancho / escala) * k)));
        const alto = Math.max(1, Math.min(lona.height - y, Math.round((caja.alto / escala) * k)));
        if (ancho <= 0 || alto <= 0) continue;

        const datos = contexto.getImageData(x, y, ancho, alto).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let total = 0;
        for (let i = 0; i < datos.length; i += 4) {
          r += datos[i];
          g += datos[i + 1];
          b += datos[i + 2];
          total += 1;
        }
        if (total > 0) salida[clave] = aHex(r / total, g / total, b / total);
      }
      this.fondosMuestreados.set(salida);
    } catch {
      // Lienzo «manchado» por una imagen de otro origen: sin aviso de contraste.
      this.fondosMuestreados.set({});
    }
  }

  // --- Apoyo ---

  /** Cambia un hueco en el borrador (el dueño del dato es la pantalla). */
  private aplicarCaja(
    clave: ClaveCampoCertificado,
    caja: Partial<CampoCertificado>,
  ): void {
    const campos = this.borrador().campos;
    const actual = campos[clave];
    if (!actual) return;
    this.cambio.emit({
      campos: {
        ...campos,
        [clave]: { ...actual, ...caja },
      },
    });
  }

  /** Aplica un estilo al hueco seleccionado. */
  private cambiarEstilo(cambio: Partial<CampoCertificado>): void {
    const item = this.seleccionada();
    if (!item) return;
    this.aplicarCaja(item.clave, cambio);
  }

  /** Píxeles de plantilla por píxel de pantalla del lienzo. */
  private escala(marco: HTMLElement): number {
    const ancho = marco.getBoundingClientRect().width;
    return ancho > 0 ? this.lienzo().anchoPx / ancho : 1;
  }

  /** El punto del ratón, en píxeles de la plantilla. */
  private aCoordenadas(
    evento: PointerEvent,
  ): { x: number; y: number } | null {
    const marco = this.marco()?.nativeElement;
    if (!marco) return null;
    const caja = marco.getBoundingClientRect();
    if (caja.width === 0) return null;
    const escala = this.escala(marco);
    const lienzo = this.lienzo();
    return {
      x: Math.min(lienzo.anchoPx, Math.max(0, (evento.clientX - caja.left) * escala)),
      y: Math.min(lienzo.altoPx, Math.max(0, (evento.clientY - caja.top) * escala)),
    };
  }
}

/** El rectángulo que forman dos puntos, esté el arrastre en el sentido que sea. */
function rectanguloEntre(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Rectangulo {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    ancho: Math.abs(x2 - x1),
    alto: Math.abs(y2 - y1),
  };
}

/**
 * Un lienzo con la imagen reducida, para poder leer el color de debajo de un
 * hueco sin recorrer los 3508 × 2480 píxeles de la imagen original. Devuelve
 * `null` si el navegador no puede dibujarla.
 */
function imagenAManchaReducida(imagen: HTMLImageElement): HTMLCanvasElement | null {
  try {
    const ancho = 480;
    const alto = Math.max(1, Math.round((ancho * imagen.naturalHeight) / imagen.naturalWidth));
    const lona = document.createElement('canvas');
    lona.width = ancho;
    lona.height = alto;
    const contexto = lona.getContext('2d');
    if (!contexto) return null;
    contexto.drawImage(imagen, 0, 0, ancho, alto);
    return lona;
  } catch {
    return null;
  }
}
