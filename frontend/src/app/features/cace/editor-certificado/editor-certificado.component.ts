import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AlineacionCertificado,
  BloqueLegal,
  BorradorPlantillaCertificado,
  CampoCertificado,
  CamposCertificado,
  ClaveCampoCertificado,
} from '../../../core/models/certificado.models';
import {
  ANCHO_PT,
  ALTO_MINIMO,
  ANCHO_MINIMO,
  LienzoPlantilla,
  TAMANO_MAXIMO,
  TAMANO_MINIMO,
  altoNecesarioFirma,
  encajarCaja,
  medirTexto,
  revisarPlantilla,
} from '../../../core/utils/certificado-medidas';

/** Las alineaciones que ofrece la barra, con su etiqueta. */
const ALINEACIONES: { valor: AlineacionCertificado; etiqueta: string }[] = [
  { valor: 'left', etiqueta: 'Izquierda' },
  { valor: 'center', etiqueta: 'Centrada' },
  { valor: 'right', etiqueta: 'Derecha' },
];

/** Las esquinas desde las que se puede redimensionar una caja. */
type Esquina = 'nw' | 'ne' | 'sw' | 'se';

/** Una caja tal como se pinta en el lienzo (un dato o un párrafo legal). */
interface CajaLienzo {
  /** El identificador que sale en `data-campo`: `nombre`, `legal-constancia`… */
  id: string;
  etiqueta: string;
  tipo: 'campo' | 'legal';
  clave?: ClaveCampoCertificado;
  indice?: number;
  /** Lo que se escribe dentro de la caja. */
  texto: string;
  caja: CampoCertificado | BloqueLegal;
  /** La firma se dibuja con su raya, y su texto real es el nombre de quien firma. */
  esFirma: boolean;
}

/** Lo que se guarda para poder deshacer: la plantilla entera, no solo una caja. */
interface Instantanea {
  campos: CamposCertificado;
  textosLegales: BloqueLegal[];
  firmaNombre: string;
}

/**
 * Los datos de prueba que se pueden poner encima del lienzo. El primero es un
 * nombre largo y con acentos a propósito: es el caso que desborda un
 * certificado mal medido, y conviene verlo antes de guardar.
 */
const PRUEBAS: { id: string; etiqueta: string; nombre: string }[] = [
  {
    id: 'largo',
    etiqueta: 'Nombre largo, con acentos',
    nombre: 'María Fernanda de Jesús Rodríguez Villanueva',
  },
  {
    id: 'corto',
    etiqueta: 'Nombre corto, con acentos',
    nombre: 'José Ángel Muñoz Ruiz',
  },
  {
    id: 'extralargo',
    etiqueta: 'Nombre extralargo (para ver el aviso)',
    nombre: 'María Fernanda de Jesús Rodríguez Villanueva y Fernández de Córdoba',
  },
];

/**
 * El editor visual de la plantilla del certificado: un lienzo con la proporción
 * del A4 donde cada dato se **arrastra**, se **redimensiona** desde las esquinas
 * y se **escribe encima** con doble clic, con la barra de herramientas al lado.
 *
 * Tres ideas sostienen todo lo demás:
 *
 * 1. **No se pintan píxeles.** Cada caja sigue siendo un campo de texto por
 *    tipo (el nombre del alumno, el título, el folio…): lo que se guarda es su
 *    posición y su estilo, y al emitir se escribe el dato de verdad. El texto
 *    que se ve en el lienzo es una **muestra** editable.
 * 2. **El lienzo no miente.** Las posiciones van en porcentaje del papel, el
 *    tamaño de letra en `cqw` (relativo al ancho del lienzo) y las cuentas de
 *    «¿cabe?» se hacen con la misma fórmula que usa el PDF. Lo que se ve es lo
 *    que sale impreso.
 * 3. **El editor avisa, pero no deja colgarse.** Arrastrar nunca saca una caja
 *    del papel, y cuando el texto no cabe se marca en rojo y se bloquea
 *    guardar: la plantilla es versionada, así que siempre se puede volver atrás.
 *
 * El componente no habla con el servidor: recibe el borrador y avisa de los
 * cambios, para que la pantalla que lo usa siga siendo la dueña del guardado.
 */
@Component({
  selector: 'app-editor-certificado',
  templateUrl: './editor-certificado.component.html',
  styleUrl: './editor-certificado.component.css',
})
export class EditorCertificadoComponent {
  /** El borrador que se está editando (lo lleva la pantalla de la CACE). */
  readonly borrador = input.required<BorradorPlantillaCertificado>();
  /** URL del fondo ya resuelta, para pintarla en el lienzo. */
  readonly fondo = input<string | null>(null);
  /** Etiquetas del catálogo, en su orden. */
  readonly catalogo = input<{ clave: ClaveCampoCertificado; etiqueta: string }[]>([]);
  /** Mientras el servidor guarda, los botones se quedan quietos. */
  readonly guardando = input(false);

  readonly cambio = output<Partial<BorradorPlantillaCertificado>>();
  readonly guardar = output<void>();
  /** «Restaurar las posiciones originales»: lo aplica la pantalla. */
  readonly restaurar = output<void>();

  // --- Estado de la edición ---

  private readonly seleccion = signal<string | null>(null);
  private readonly enEdicion = signal<string | null>(null);
  private readonly zoom = signal<'ajustar' | 'completo'>('ajustar');
  private readonly guias = signal(true);
  /** El dato de prueba elegido para el nombre del alumno. */
  readonly prueba = signal(PRUEBAS[0].id);
  private readonly proporcionFondo = signal<number | null>(null);

  /** Lo que había antes de cada gesto, para poder deshacerlo. */
  private readonly pasado = signal<Instantanea[]>([]);
  private readonly futuro = signal<Instantanea[]>([]);
  /** Para agrupar en un solo paso del historial los gestos que van seguidos. */
  private ultimaClaveGesto = '';
  private ultimoGestoEn = 0;

  private readonly marco = viewChild<ElementRef<HTMLDivElement>>('marco');
  private readonly campoTexto = viewChild<ElementRef<HTMLElement>>('campoTexto');

  /** El botón de editar el texto de una caja que está en edición. */
  private instantaneaEnEdicion: Instantanea | null = null;

  constructor() {
    // Al cambiar de versión se empieza de cero: el historial de la anterior no
    // tiene por qué poder deshacerse sobre esta.
    let ultimaClave = '';
    effect(() => {
      const b = this.borrador();
      const clave = `${b.id ?? 0}-${b.version}`;
      if (clave === ultimaClave) return;
      ultimaClave = clave;
      this.pasado.set([]);
      this.futuro.set([]);
      this.seleccion.set(null);
      this.enEdicion.set(null);
    });

    // La proporción del fondo se mide cargando la imagen: es lo que permite
    // avisar de que se va a recortar (y el lienzo recorta igual que el PDF).
    effect(() => {
      const url = this.fondo();
      this.proporcionFondo.set(null);
      if (!url || typeof Image === 'undefined') return;
      const imagen = new Image();
      imagen.onload = () => {
        if (this.fondo() !== url) return;
        this.proporcionFondo.set(imagen.naturalWidth / imagen.naturalHeight);
      };
      imagen.src = url;
    });

    // Al empezar a escribir, el foco va al texto y se selecciona entero: el
    // doble clic sirve para reemplazar el nombre, no para pelear con el cursor.
    effect(() => {
      const elemento = this.campoTexto()?.nativeElement;
      if (!elemento || !this.enEdicion()) return;
      elemento.focus();
      const rango = document.createRange();
      rango.selectNodeContents(elemento);
      const seleccion = window.getSelection();
      seleccion?.removeAllRanges();
      seleccion?.addRange(rango);
    });
  }

  // --- Lo que se pinta ---

  readonly lienzo = computed<LienzoPlantilla>(() => {
    const b = this.borrador();
    return { anchoPx: b.anchoPx, altoPx: b.altoPx };
  });

  readonly alineaciones = ALINEACIONES;
  readonly pruebas = PRUEBAS;
  readonly tamanoMinimo = TAMANO_MINIMO;
  readonly tamanoMaximo = TAMANO_MAXIMO;

  /** Datos y párrafos legales, ya listos para el lienzo. */
  readonly cajas = computed<CajaLienzo[]>(() => {
    const b = this.borrador();
    const firma = b.firmaNombre.trim();
    const salida: CajaLienzo[] = [];

    for (const entrada of this.catalogo()) {
      const caja = b.campos[entrada.clave];
      if (!caja) continue;
      salida.push({
        id: entrada.clave,
        etiqueta: entrada.etiqueta,
        tipo: 'campo',
        clave: entrada.clave,
        texto:
          entrada.clave === 'firma'
            ? firma || caja.muestra || 'Nombre del presidente'
            : caja.muestra,
        caja,
        esFirma: entrada.clave === 'firma',
      });
    }

    b.textosLegales.forEach((bloque, indice) => {
      salida.push({
        id: bloque.id,
        etiqueta: `Párrafo legal ${indice + 1}`,
        tipo: 'legal',
        indice,
        texto: bloque.texto,
        caja: bloque,
        esFirma: false,
      });
    });

    return salida;
  });

  /** La caja seleccionada (o `null`). La barra enseña y cambia sus valores. */
  readonly seleccionada = computed<CajaLienzo | null>(() => {
    const id = this.seleccion();
    if (!id) return null;
    return this.cajas().find((c) => c.id === id) ?? null;
  });

  /**
   * Los problemas del diseño. Los **graves** bloquean guardar; los avisos solo
   * se enseñan. Se calculan con las muestras que están a la vista.
   */
  readonly problemas = computed(() =>
    revisarPlantilla({
      campos: this.borrador().campos,
      textosLegales: this.borrador().textosLegales,
      lienzo: this.lienzo(),
      firmaNombre: this.borrador().firmaNombre,
      proporcionFondo: this.proporcionFondo(),
      hayFondo: !!this.borrador().fondoUrl,
      etiquetas: this.catalogo(),
    }),
  );

  readonly graves = computed(() =>
    this.problemas().filter((p) => p.gravedad === 'grave'),
  );
  readonly avisos = computed(() =>
    this.problemas().filter((p) => p.gravedad === 'aviso'),
  );
  readonly puedeGuardar = computed(
    () => !this.guardando() && this.graves().length === 0,
  );

  readonly puedeDeshacer = computed(() => this.pasado().length > 0);
  readonly puedeRehacer = computed(() => this.futuro().length > 0);
  readonly estaEnZoomCompleto = computed(() => this.zoom() === 'completo');
  readonly verGuias = computed(() => this.guias());

  /** ¿La caja cabe en su caja de texto? Se usa para pintarla en rojo. */
  readonly desbordes = computed<Record<string, boolean>>(() => {
    const lienzo = this.lienzo();
    const salida: Record<string, boolean> = {};
    for (const item of this.cajas()) {
      if (!item.texto.trim()) continue;
      const desbordaTexto = medirTexto(item.texto, item.caja, lienzo).desborda;
      salida[item.id] = item.esFirma
        ? desbordaTexto ||
          altoNecesarioFirma(item.caja.tamano, lienzo) > item.caja.alto + 0.5
        : desbordaTexto;
    }
    return salida;
  });

  /** Cuántas líneas ocupa el texto seleccionado: se enseña en la barra. */
  readonly lineasSeleccion = computed(() => {
    const item = this.seleccionada();
    if (!item || !item.texto.trim()) return null;
    return medirTexto(item.texto, item.caja, this.lienzo()).lineas;
  });

  // --- Posiciones y tamaños en el DOM ---

  /** Posición en porcentaje del papel (lo mismo que hace el PDF en puntos). */
  porcentaje(valor: number, lado: 'x' | 'y'): string {
    const lienzo = this.lienzo();
    const total = lado === 'y' ? lienzo.altoPx : lienzo.anchoPx;
    return `${(valor / total) * 100}%`;
  }

  /**
   * Tamaño de letra en `cqw`: relativo al ancho del lienzo, que es la misma
   * proporción que usa el PDF (el ancho de la hoja es `ANCHO_PT` puntos).
   */
  tamanoEnCqw(tamano: number): string {
    return `${(tamano / ANCHO_PT) * 100}cqw`;
  }

  /**
   * Un desplazamiento **vertical** en puntos del PDF, en `cqw`. El lienzo
   * mantiene la proporción del papel, así que un punto mide lo mismo a lo ancho
   * que a lo alto: así el nombre y el cargo de la firma caen donde los dibuja
   * `certificado-pdf.service.ts`.
   */
  enCqw(puntos: number): string {
    return `${(puntos / ANCHO_PT) * 100}cqw`;
  }

  esSeleccionada(id: string): boolean {
    return this.seleccion() === id;
  }

  estaEditando(id: string): boolean {
    return this.enEdicion() === id;
  }

  // --- Selección y edición de texto ---

  seleccionar(id: string | null, evento?: Event): void {
    if (this.enEdicion() && this.enEdicion() !== id) this.confirmarTexto();
    if (evento) evento.stopPropagation();
    this.seleccion.set(id);
  }

  /** Doble clic en una caja: se escribe encima. */
  empezarEdicion(id: string, evento: Event): void {
    evento.stopPropagation();
    if (this.enEdicion() === id) return;
    if (this.enEdicion()) this.confirmarTexto();
    this.seleccion.set(id);
    this.instantaneaEnEdicion = this.instantanea();
    this.enEdicion.set(id);
  }

  /** Se cierra la edición y se guarda lo escrito. */
  confirmarTexto(): void {
    const id = this.enEdicion();
    if (!id) return;
    const elemento = this.campoTexto()?.nativeElement;
    const texto = (elemento?.innerText ?? '').replace(/\u00a0/g, ' ').trim();
    this.enEdicion.set(null);
    this.campoTexto()?.nativeElement.blur?.();

    const item = this.cajas().find((c) => c.id === id);
    if (!item) return;
    if (texto === item.texto) {
      this.instantaneaEnEdicion = null;
      return;
    }
    this.registrarGesto(this.instantaneaEnEdicion);
    this.instantaneaEnEdicion = null;
    this.escribirTexto(item, texto);
  }

  cancelarTexto(): void {
    this.enEdicion.set(null);
    this.instantaneaEnEdicion = null;
  }

  /** Teclas dentro de la edición: Intro guarda, Escape descarta. */
  teclaEnTexto(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      this.confirmarTexto();
    }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.cancelarTexto();
    }
  }

  // --- Arrastrar y redimensionar ---

  /**
   * Arrastre con eventos de puntero (ratón, dedo o lápiz, da igual: `pointer*`
   * cubre los tres). El movimiento se escucha en el documento y no en la caja,
   * para que el gesto no se corte al salir de ella ni al pasar por encima de
   * otro dato.
   */
  arrastrar(evento: PointerEvent, id: string): void {
    if (evento.button !== 0) return;
    if (this.enEdicion()) {
      // Agarrar la caja que se está editando es seleccionar texto, no moverla.
      if (this.enEdicion() === id) return;
      this.confirmarTexto();
    }
    const marco = this.marco()?.nativeElement;
    const item = this.cajas().find((c) => c.id === id);
    if (!marco || !item) return;

    evento.preventDefault();
    evento.stopPropagation();
    this.seleccion.set(id);

    const escala = this.escala(marco);
    const antes = this.instantanea();
    const inicioX = evento.clientX;
    const inicioY = evento.clientY;
    const origen = { x: item.caja.x, y: item.caja.y };
    let movido = false;

    const mover = (movimiento: PointerEvent) => {
      const dx = (movimiento.clientX - inicioX) / escala;
      const dy = (movimiento.clientY - inicioY) / escala;
      if (!movido && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      movido = true;
      this.aplicarCaja(
        item,
        encajarCaja(
          { ...item.caja, x: origen.x + dx, y: origen.y + dy },
          this.lienzo(),
        ),
      );
    };

    const soltar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
      if (movido) this.registrarGesto(antes);
    };

    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
  }

  /** Redimensión desde una esquina: se mueve el lado que se agarra. */
  redimensionar(evento: PointerEvent, id: string, esquina: Esquina): void {
    if (evento.button !== 0) return;
    const marco = this.marco()?.nativeElement;
    const item = this.cajas().find((c) => c.id === id);
    if (!marco || !item) return;

    evento.preventDefault();
    evento.stopPropagation();
    this.seleccion.set(id);

    const escala = this.escala(marco);
    const lienzo = this.lienzo();
    const antes = this.instantanea();
    const inicioX = evento.clientX;
    const inicioY = evento.clientY;
    const original = {
      x: item.caja.x,
      y: item.caja.y,
      ancho: item.caja.ancho,
      alto: item.caja.alto,
    };
    let movido = false;

    const mover = (movimiento: PointerEvent) => {
      const dx = (movimiento.clientX - inicioX) / escala;
      const dy = (movimiento.clientY - inicioY) / escala;
      if (!movido && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      movido = true;

      let { x, y, ancho, alto } = original;
      if (esquina.includes('e')) ancho = original.ancho + dx;
      if (esquina.includes('s')) alto = original.alto + dy;
      if (esquina.includes('w')) {
        ancho = original.ancho - dx;
        x = original.x + dx;
      }
      if (esquina.includes('n')) {
        alto = original.alto - dy;
        y = original.y + dy;
      }

      // El mínimo se respeta moviendo el lado contrario, para que la caja no
      // «salte» cuando se encoge por debajo del tamaño más pequeño.
      if (ancho < ANCHO_MINIMO) {
        if (esquina.includes('w')) x = original.x + original.ancho - ANCHO_MINIMO;
        ancho = ANCHO_MINIMO;
      }
      if (alto < ALTO_MINIMO) {
        if (esquina.includes('n')) y = original.y + original.alto - ALTO_MINIMO;
        alto = ALTO_MINIMO;
      }
      if (x < 0) {
        ancho += x;
        x = 0;
      }
      if (y < 0) {
        alto += y;
        y = 0;
      }
      ancho = Math.min(ancho, lienzo.anchoPx - x);
      alto = Math.min(alto, lienzo.altoPx - y);

      this.aplicarCaja(item, { x, y, ancho, alto });
    };

    const soltar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
      if (movido) this.registrarGesto(antes);
    };

    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
  }

  // --- Barra de herramientas ---

  cambiarTamano(delta: number): void {
    const item = this.seleccionada();
    if (!item) return;
    const tamano = Math.min(
      TAMANO_MAXIMO,
      Math.max(TAMANO_MINIMO, item.caja.tamano + delta),
    );
    this.cambiarEstilo({ tamano }, `tamano-${item.id}`);
  }

  fijarTamano(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    if (!Number.isFinite(valor)) return;
    this.cambiarEstilo(
      {
        tamano: Math.min(
          TAMANO_MAXIMO,
          Math.max(TAMANO_MINIMO, Math.round(valor)),
        ),
      },
      'tamano-tecleado',
    );
  }

  alternarNegrita(): void {
    const item = this.seleccionada();
    if (!item) return;
    this.cambiarEstilo({ negrita: !item.caja.negrita });
  }

  alternarCursiva(): void {
    const item = this.seleccionada();
    if (!item) return;
    this.cambiarEstilo({ cursiva: !item.caja.cursiva });
  }

  alinear(alineacion: AlineacionCertificado): void {
    this.cambiarEstilo({ alineacion });
  }

  fijarColor(evento: Event): void {
    const color = (evento.target as HTMLInputElement).value;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      this.cambiarEstilo({ color }, 'color');
    }
  }

  /** Aplica un estilo a la caja seleccionada, con su paso por el historial. */
  private cambiarEstilo(
    cambio: Partial<CampoCertificado & BloqueLegal>,
    claveGesto = '',
  ): void {
    const item = this.seleccionada();
    if (!item) return;
    this.registrarGesto(null, claveGesto);
    this.aplicarCaja(item, {
      ...item.caja,
      ...cambio,
    } as CampoCertificado & BloqueLegal);
  }

  cambiarFirma(valor: string): void {
    const b = this.borrador();
    if (valor === b.firmaNombre) return;
    this.registrarGesto(null, 'firma');
    this.cambio.emit({ firmaNombre: valor.slice(0, 160) });
  }

  // --- Zoom, guías e historial ---

  ajustarAlAncho(): void {
    this.zoom.set('ajustar');
  }

  verAlCien(): void {
    this.zoom.set('completo');
  }

  alternarGuias(): void {
    this.guias.update((v) => !v);
  }

  /** Cambia la muestra del nombre del alumno por otro dato de prueba. */
  cambiarPrueba(evento: Event): void {
    const id = (evento.target as HTMLSelectElement).value;
    const prueba = PRUEBAS.find((p) => p.id === id);
    if (!prueba) return;
    this.prueba.set(id);
    const b = this.borrador();
    this.registrarGesto(null);
    this.cambio.emit({
      campos: {
        ...b.campos,
        nombre: { ...b.campos.nombre, muestra: prueba.nombre },
      },
    });
  }

  deshacer(): void {
    const pasado = this.pasado();
    const anterior = pasado[pasado.length - 1];
    if (!anterior) return;
    this.futuro.update((f) => [this.instantanea(), ...f].slice(0, 50));
    this.pasado.set(pasado.slice(0, -1));
    this.aplicarInstantanea(anterior);
  }

  rehacer(): void {
    const futuro = this.futuro();
    const siguiente = futuro[0];
    if (!siguiente) return;
    this.pasado.update((p) => [...p, this.instantanea()].slice(-50));
    this.futuro.set(futuro.slice(1));
    this.aplicarInstantanea(siguiente);
  }

  restaurarPosiciones(): void {
    this.registrarGesto(null);
    this.restaurar.emit();
  }

  guardarPlantilla(): void {
    if (!this.puedeGuardar()) return;
    this.guardar.emit();
  }

  // --- Apoyo ---

  /** Añade un párrafo legal debajo del último bloque. */
  agregarLegal(): void {
    const b = this.borrador();
    if (b.textosLegales.length >= 10) return;
    const ultimo = b.textosLegales[b.textosLegales.length - 1];
    // Debajo del último, y siempre dentro del papel (y del mínimo de la caja).
    const y = ultimo
      ? Math.max(
          0,
          Math.min(ultimo.y + ultimo.alto + 20, b.altoPx - ALTO_MINIMO - 20),
        )
      : Math.round(b.altoPx * 0.86);
    const nuevo: BloqueLegal = {
      id: `legal-${Date.now()}`,
      texto: 'Escribe aquí el texto legal.',
      x: 240,
      y,
      ancho: Math.min(b.anchoPx, Math.max(400, b.anchoPx - 480)),
      alto: 90,
      tamano: 12,
      alineacion: 'center',
      color: '#666666',
      negrita: false,
      cursiva: false,
    };
    this.registrarGesto(null);
    this.cambio.emit({ textosLegales: [...b.textosLegales, nuevo] });
    this.seleccion.set(nuevo.id);
  }

  quitarLegal(): void {
    const item = this.seleccionada();
    if (!item || item.tipo !== 'legal') return;
    this.registrarGesto(null);
    this.cambio.emit({
      textosLegales: this.borrador().textosLegales.filter(
        (b) => b.id !== item.id,
      ),
    });
    this.seleccion.set(null);
  }

  /** ¿Hay un párrafo legal seleccionado? Habilita el botón de quitarlo. */
  readonly legalSeleccionado = computed(
    () => this.seleccionada()?.tipo === 'legal',
  );

  /** Píxeles de plantilla por píxel de pantalla del lienzo. */
  private escala(marco: HTMLElement): number {
    const ancho = marco.getBoundingClientRect().width;
    return ancho > 0 ? this.lienzo().anchoPx / ancho : 1;
  }

  /** Cambia una caja en el borrador (el dueño del dato es la pantalla). */
  private aplicarCaja(
    item: CajaLienzo,
    caja: Partial<CampoCertificado & BloqueLegal>,
  ): void {
    if (item.tipo === 'campo' && item.clave) {
      const campos = this.borrador().campos;
      this.cambio.emit({
        campos: {
          ...campos,
          [item.clave]: { ...campos[item.clave], ...caja },
        },
      });
      return;
    }
    this.cambio.emit({
      textosLegales: this.borrador().textosLegales.map((bloque) =>
        bloque.id === item.id ? { ...bloque, ...caja } : bloque,
      ),
    });
  }

  /** Escribe el texto que se acaba de teclear dentro de una caja. */
  private escribirTexto(item: CajaLienzo, texto: string): void {
    if (item.tipo === 'campo' && item.clave === 'firma') {
      this.cambio.emit({ firmaNombre: texto.slice(0, 160) });
      return;
    }
    if (item.tipo === 'campo' && item.clave) {
      const campos = this.borrador().campos;
      this.cambio.emit({
        campos: {
          ...campos,
          [item.clave]: { ...campos[item.clave], muestra: texto.slice(0, 400) },
        },
      });
      return;
    }
    this.cambio.emit({
      textosLegales: this.borrador().textosLegales.map((bloque) =>
        bloque.id === item.id ? { ...bloque, texto: texto.slice(0, 1200) } : bloque,
      ),
    });
  }

  /** La plantilla tal como está ahora, para el historial. */
  private instantanea(): Instantanea {
    const b = this.borrador();
    const campos = {} as CamposCertificado;
    for (const clave of Object.keys(b.campos) as ClaveCampoCertificado[]) {
      campos[clave] = { ...b.campos[clave] };
    }
    return {
      campos,
      textosLegales: b.textosLegales.map((bloque) => ({ ...bloque })),
      firmaNombre: b.firmaNombre,
    };
  }

  /**
   * Apunta el estado anterior de un gesto. Recibe el estado capturado al
   * empezar (un arrastre, por ejemplo) o `null` para capturarlo ahora mismo
   * (un cambio de estilo, que es instantáneo).
   *
   * `clave` sirve para agrupar gestos seguidos del mismo tipo (escribir un
   * nombre, arrastrar el selector de color): sin eso, cada pulsación de tecla
   * dejaría su propio paso en el historial y deshacer sería inútil.
   */
  private registrarGesto(antes: Instantanea | null, clave = ''): void {
    const ahora = Date.now();
    const seguido =
      clave !== '' &&
      clave === this.ultimaClaveGesto &&
      ahora - this.ultimoGestoEn < 1500;
    this.ultimaClaveGesto = clave;
    this.ultimoGestoEn = ahora;
    if (seguido) return;

    const estado = antes ?? this.instantanea();
    this.pasado.update((p) => [...p, estado].slice(-50));
    this.futuro.set([]);
  }

  private aplicarInstantanea(estado: Instantanea): void {
    // Deshacer o rehacer corta cualquier gesto en curso: lo que venga después
    // tiene que ser un paso nuevo en el historial, no la continuación del otro.
    this.ultimaClaveGesto = '';
    this.cambio.emit({
      campos: estado.campos,
      textosLegales: estado.textosLegales,
      firmaNombre: estado.firmaNombre,
    });
  }
}
