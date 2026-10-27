import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, switchMap, takeWhile, timer } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { EnviosService } from '../../core/services/envios.service';
import { ProgresoLote } from '../../core/models/envios.models';
import { ProyectosService } from '../../core/services/proyectos.service';
import { ListasAlumnosService } from '../../core/services/listas-alumnos.service';
import { CertificadosService } from '../../core/services/certificados.service';
import {
  AlumnoLista,
  ListaAlumnos,
  PrevisualizacionLista,
} from '../../core/models/lista-alumnos.models';
import {
  CertificadoEmitido,
  EstadoCertificados,
  ResultadoEnvioCertificados,
} from '../../core/models/certificado.models';
import { MateriasService } from '../../core/services/materias.service';
import { InstitucionesService } from '../../core/services/instituciones.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { urlDeArchivo } from '../../core/utils/url-archivo.util';
import { fechaLarga, fechaTexto, instanteDesdeLocal } from '../../core/utils/fecha.util';
import { descargarBlob } from '../../core/utils/descarga.util';
import { estadoProyectoLabel as etiquetaEstadoProyecto } from '../../core/constants/catalogos';
import { Asignacion } from '../../core/models/materia.models';
import {
  Actividad,
  EnvioCalendario,
  Evaluacion,
  Evidencia,
  Mensaje,
  ParticipacionPlanificacion,
  ParticipacionReporte,
  Proyecto,
  ReporteClase,
  Sesion,
} from '../../core/models/proyecto.models';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { PendienteUi, UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-proyecto',
  imports: [ReactiveFormsModule, RouterLink, ModalComponent, LayoutComponent],
  templateUrl: './proyecto.component.html',
})
export class ProyectoComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly proyectos = inject(ProyectosService);
  private readonly materiasService = inject(MateriasService);
  private readonly instituciones = inject(InstitucionesService);
  private readonly listasService = inject(ListasAlumnosService);
  private readonly certificadosService = inject(CertificadosService);
  private readonly envios = inject(EnviosService);
  private readonly fb = inject(FormBuilder);
  /** Estado compartido con el esqueleto (campana y contadores). */
  readonly ui = inject(UiStateService);

  constructor() {
    // Cuando cambia cualquier dato del proyecto se recalcula lo que la campana
    // de la barra superior debe avisar.
    effect(() => {
      this.proyecto();
      this.sesiones();
      this.reportesClase();
      this.evaluaciones();
      this.publicarEnLayout();
    });
  }

  readonly usuario = this.auth.currentUser();
  /** Zona horaria del navegador, para avisar en qué hora se ven las sesiones. */
  readonly zonaHoraria =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'tu zona';
  readonly esAgente = this.usuario?.rol === 'AGENTE';
  readonly esDocente = this.usuario?.rol === 'DOCENTE';
  /**
   * Vuelta al panel. Es la misma URL para todos los roles: `/panel` decide qué
   * pantalla se pinta según el rol, así que la dirección no delata quién eres.
   */
  readonly panelUrl = '/panel';

  /** Plantilla de ejemplo para subir la lista (descargable desde la sección). */
  readonly urlPlantillaAlumnos = urlDeArchivo('/plantillas/plantilla-lista-alumnos.xlsx');

  // --- Lista de alumnos (la base de los certificados) ---
  /** La lista guardada de la institución del docente, si ya subió una. */
  readonly listaAlumnos = signal<ListaAlumnos | null>(null);
  /** Lo que se leyó del archivo o del texto, antes de guardarlo. */
  readonly vistaPrevia = signal<PrevisualizacionLista | null>(null);
  readonly textoPegado = signal('');
  /** El docente quiere subir una lista nueva encima de la guardada. */
  readonly modoReemplazo = signal(false);
  readonly cargandoLista = signal(false);
  readonly leyendoLista = signal(false);
  readonly guardandoLista = signal(false);
  /** Declaración expresa antes de guardar datos de alumnos. */
  readonly declaraConsentimientoAlumnos = signal(false);
  readonly errorLista = signal<string | null>(null);
  readonly avisoLista = signal<string | null>(null);

  // --- Certificados (fase 4) ---
  /** Todo lo que necesita la sección: si se puede emitir, qué falta y qué hay. */
  readonly certificadosEstado = signal<EstadoCertificados | null>(null);
  readonly cargandoCertificados = signal(false);
  readonly emitiendoCertificados = signal(false);
  readonly errorCertificados = signal<string | null>(null);
  readonly avisoCertificados = signal<string | null>(null);
  /** Certificado cuyo PDF se está descargando (evita el doble clic). */
  readonly descargandoCertificado = signal<number | null>(null);
  readonly descargandoZip = signal(false);
  /** Alumnos que ya tenían certificado: se listan con su motivo. */
  readonly certificadosOmitidos = signal<{ alumnoId: number; alumno: string; motivo: string }[]>(
    [],
  );

  // --- Envío por correo a los alumnos (fase 5) ---
  /** Certificado cuyo correo se está enviando (evita el doble clic). */
  readonly enviandoCertificado = signal<number | null>(null);
  readonly enviandoTodos = signal(false);
  /** Lo que el envío no pudo entregar, con el motivo, para poder explicarlo. */
  readonly envioOmitidos = signal<
    { certificadoId: number; folio: string; alumno: string; motivo: string }[]
  >([]);
  readonly envioFallidos = signal<
    { certificadoId: number; folio: string; alumno: string; correo: string; motivo: string }[]
  >([]);
  readonly envioSinCorreo = signal<{ certificadoId: number; folio: string; alumno: string }[]>([]);

  // --- Cola de correo (Fase 2) ---
  /** Progreso del lote en curso o del último terminado. */
  readonly progresoEnvio = signal<ProgresoLote | null>(null);
  readonly loteEnvio = signal<string | null>(null);
  private loteSub?: Subscription;

  // --- Anulación (fase 5) ---
  /** Certificado que se está anulando y el motivo que se está escribiendo. */
  readonly certificadoAAnular = signal<CertificadoEmitido | null>(null);
  readonly motivoAnulacion = signal('');
  readonly anulandoCertificado = signal(false);
  readonly errorAnulacion = signal<string | null>(null);

  /** Lista de certificados emitidos en un modal: la tabla no cabe bien en la tarjeta. */
  readonly verCertificados = signal(false);

  /** Folio cuyo enlace de verificación se acaba de copiar. */
  readonly enlaceCopiado = signal<string | null>(null);

  /** Correo que el docente está escribiendo para un alumno que no tiene. */
  readonly correosNuevos = signal<Record<number, string>>({});
  readonly guardandoCorreo = signal<number | null>(null);

  /** ¿Se puede pulsar «Emitir»? El servidor vuelve a comprobarlo igual. */
  readonly puedeEmitirCertificados = computed(() => {
    const estado = this.certificadosEstado();
    return (
      !!estado && estado.claseCerrada && !!estado.plantilla && (estado.lista?.incluidos ?? 0) > 0
    );
  });

  /** ¿Hay algún certificado vigente al que se le pueda enviar el correo? */
  readonly puedeEnviarCertificados = computed(() =>
    (this.certificadosEstado()?.certificados ?? []).some((c) => c.estado === 'EMITIDO'),
  );

  /** Nombre completo para la navbar. */
  get nombreUsuario(): string {
    const u = this.usuario;
    return u ? `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}` : '';
  }

  proyectoId = 0;
  proyecto = signal<Proyecto | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);

  // --- Proyecto (agente) ---
  proyectoForm = this.fb.group({
    estado: ['', Validators.required],
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    plataforma: ['', Validators.required],
  });
  guardandoProyecto = signal(false);

  // --- Docentes del proyecto (agente) ---
  asignaciones = signal<Asignacion[]>([]);
  miInstitucionId = signal<number | null>(null);
  asignacionSeleccionada = this.fb.control<number | null>(null);
  agregandoDocente = signal(false);

  // --- Planificación conjunta ---
  planificacionForm = this.fb.group({
    objetivosAcordados: ['', Validators.required],
    temasAcordados: ['', Validators.required],
    metodologia: ['', Validators.required],
    plataforma: ['', Validators.required],
    estado: ['BORRADOR'],
  });
  guardandoPlanificacion = signal(false);
  confirmando = signal(false);

  // --- Acta de supervisión (agente) ---
  reporteForm = this.fb.group({
    vistoBueno: [true],
    observaciones: [''],
  });
  generandoReporte = signal(false);

  // --- Chat del proyecto ---
  mensajes = signal<Mensaje[]>([]);
  enviandoMensaje = signal(false);
  mensajeForm = this.fb.group({
    contenido: ['', Validators.required],
  });
  private mensajesInterval: ReturnType<typeof setInterval> | null = null;
  private mensajesEnVuelo = false;
  private erroresMensajes = 0;
  chatAbierto = signal(false);
  errorChat = signal<string | null>(null);

  private readonly chatScroll = viewChild<ElementRef<HTMLDivElement>>('chatScroll');
  private ultimoConteoMensajes = 0;

  // --- Sesiones, actividades y evidencias (Semana 6) ---
  sesiones = signal<Sesion[]>([]);
  actividades = signal<Actividad[]>([]);
  evidencias = signal<Evidencia[]>([]);

  sesionForm = this.fb.group({
    titulo: ['', Validators.required],
    fechaHora: ['', Validators.required],
    enlaceVirtual: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
  });
  actividadForm = this.fb.group({
    titulo: ['', Validators.required],
    instrucciones: ['', Validators.required],
    fechaLimite: ['', Validators.required],
  });
  evidenciaForm = this.fb.group({
    tipo: [''],
    sesionId: this.fb.control<number | null>(null),
    enlaceUrl: [''],
  });
  archivoSeleccionado = signal<File | null>(null);
  /** Enlace o archivo: nunca las dos cosas a la vez. */
  readonly modoEvidencia = signal<'ARCHIVO' | 'ENLACE'>('ARCHIVO');

  // --- Reporte de clase, evaluación final y cierre (Semana 7) ---
  reportesClase = signal<ReporteClase[]>([]);
  evaluaciones = signal<Evaluacion[]>([]);

  /** Sesión cuyo reporte de clase se está redactando. */
  sesionReporteAbierta = signal<number | null>(null);
  reporteClaseForm = this.fb.group({
    desarrolloClase: ['', Validators.required],
    totalAsistentes: [0, [Validators.required, Validators.min(0)]],
    incidencias: ['', Validators.required],
    acuerdosSiguienteSesion: ['', Validators.required],
  });

  /** Reporte cuya participación está confirmando el docente. */
  reporteAConfirmar = signal<number | null>(null);
  observacionesForm = this.fb.group({
    observaciones: ['', Validators.required],
  });

  evaluacionForm = this.fb.group({
    instrumento: ['', Validators.required],
    resultado: ['', Validators.required],
    observaciones: ['', Validators.required],
  });
  cerrando = signal(false);

  // Botones que deben bloquearse mientras guardan (evita el doble envío).
  guardandoSesion = signal(false);
  guardandoActividad = signal(false);
  subiendoEvidencia = signal(false);
  guardandoReporteClase = signal(false);
  confirmandoReporteClase = signal(false);
  guardandoEvaluacion = signal(false);
  descargandoResumenPdf = signal(false);
  descargandoCalendario = signal(false);
  /** Envío del calendario por correo (mientras va, el botón se bloquea). */
  enviandoCalendario = signal(false);
  /** Resultado del último envío: a quién llegó y a quién no. */
  envioCalendario = signal<EnvioCalendario | null>(null);

  // Confirmaciones con el mismo modal que usa el resto de la aplicación.
  confirmacion = signal<{
    titulo: string;
    mensaje: string;
    accion: () => void;
  } | null>(null);

  ngOnInit(): void {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.proyectoId) {
      this.router.navigate([this.panelUrl]);
      return;
    }

    this.cargar();
    this.cargarSesiones();
    this.cargarActividades();
    this.cargarEvidencias();
    this.cargarReportesClase();
    this.cargarEvaluaciones();

    if (this.esAgente) {
      this.materiasService.listarAsignaciones().subscribe({
        next: (r) => this.asignaciones.set(r),
        error: () => this.asignaciones.set([]),
      });
      // Sin esta institución no se puede saber el rol del docente que se agrega.
      this.instituciones.obtenerMia().subscribe({
        next: (i) => this.miInstitucionId.set(i.id),
        error: (err: HttpErrorResponse) =>
          this.error.set(
            extraerMensajeError(
              err,
              'No se pudo determinar tu institución: recarga la página antes de agregar docentes',
            ),
          ),
      });
    }
  }

  ngOnDestroy(): void {
    this.loteSub?.unsubscribe();
    if (this.mensajesInterval) clearInterval(this.mensajesInterval);
    // Al salir no se dejan avisos de esta clase espejo en la barra superior.
    this.ui.limpiarPantalla();
  }

  /**
   * Publica en el esqueleto lo que falta en esta clase espejo: sesiones sin
   * reporte firmado, sesiones programadas y la evaluación final.
   */
  private publicarEnLayout(): void {
    const proyecto = this.proyecto();
    if (!proyecto || !this.proyectoAbierto()) {
      this.ui.publicarPendientes([]);
      this.ui.publicarChats([]);
      this.ui.publicarContadores({});
      return;
    }

    const confirmados = new Set(
      this.reportesClase()
        .filter((r) => r.estado === 'CONFIRMADO')
        .map((r) => r.sesionId),
    );
    const sinReporte = this.sesiones().filter(
      (s) => s.estado !== 'CANCELADA' && !confirmados.has(s.id),
    ).length;
    const programadas = this.sesiones().filter((s) => s.estado === 'PROGRAMADA').length;

    const avisos: PendienteUi[] = [];
    if (sinReporte > 0) {
      avisos.push({
        titulo: `${sinReporte} sesión(es) sin reporte confirmado`,
        detalle: 'Cada sesión necesita su reporte de clase firmado.',
        ancla: 'sesiones',
        tono: 'aviso',
      });
    }
    if (programadas > 0) {
      avisos.push({
        titulo: `${programadas} sesión(es) por impartir`,
        detalle: 'Revisa la fecha y el enlace virtual.',
        ancla: 'sesiones',
        tono: 'ok',
      });
    }
    if (this.evaluaciones().length === 0) {
      avisos.push({
        titulo: 'Falta la evaluación final',
        detalle: 'Se necesita al menos una para poder cerrar la clase espejo.',
        ancla: 'evaluacion',
        tono: 'aviso',
      });
    }
    this.ui.publicarPendientes(avisos);
    // El chat de esta clase se abre con el botón flotante de la pantalla.
    this.ui.publicarChats([]);
    this.ui.publicarContadores({});
  }

  cargarMensajes(): void {
    // Sin este cerrojo, una respuesta antigua podía pisar la lista y dejar
    // fuera el mensaje recién enviado.
    if (this.mensajesEnVuelo) return;
    this.mensajesEnVuelo = true;

    this.proyectos.listarMensajes(this.proyectoId).subscribe({
      next: (r) => {
        this.mensajesEnVuelo = false;
        this.erroresMensajes = 0;
        const hayNuevos = r.length !== this.ultimoConteoMensajes;
        this.ultimoConteoMensajes = r.length;
        this.mensajes.set(r);
        if (hayNuevos) {
          setTimeout(() => this.scrollChatAbajo());
        }
      },
      error: () => {
        this.mensajesEnVuelo = false;
        this.erroresMensajes += 1;
        // Tras varios fallos seguidos se deja de insistir cada 3 segundos.
        if (this.erroresMensajes >= 5) this.detenerPollingMensajes();
      },
    });
  }

  private scrollChatAbajo(): void {
    const el = this.chatScroll()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  abrirChat(): void {
    this.chatAbierto.set(true);
    this.errorChat.set(null);
    this.cargarMensajes();
    // El sondeo solo corre con el chat abierto: antes latía cada 3 s siempre.
    this.detenerPollingMensajes();
    this.mensajesInterval = setInterval(() => this.cargarMensajes(), 3000);
    setTimeout(() => this.scrollChatAbajo());
  }

  cerrarChat(): void {
    this.chatAbierto.set(false);
    this.detenerPollingMensajes();
  }

  private detenerPollingMensajes(): void {
    if (this.mensajesInterval) {
      clearInterval(this.mensajesInterval);
      this.mensajesInterval = null;
    }
  }

  enviarMensaje(): void {
    if (this.enviandoMensaje() || this.mensajeForm.invalid) return;
    const contenido = (this.mensajeForm.get('contenido')?.value ?? '').trim();
    if (!contenido) return;

    this.enviandoMensaje.set(true);
    this.proyectos.enviarMensaje(this.proyectoId, contenido).subscribe({
      next: () => {
        this.enviandoMensaje.set(false);
        this.mensajeForm.reset({ contenido: '' });
        this.cargarMensajes();
      },
      error: (err: HttpErrorResponse) => {
        this.enviandoMensaje.set(false);
        // El error se muestra dentro del chat: la alerta de la página queda
        // tapada por el propio modal.
        this.errorChat.set(extraerMensajeError(err, 'Error al enviar el mensaje'));
      },
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.proyectos.obtener(this.proyectoId).subscribe({
      next: (p) => {
        this.proyecto.set(p);
        this.proyectoForm.patchValue({
          estado: p.estado,
          fechaInicio: this.aFechaInput(p.fechaInicio),
          fechaFin: this.aFechaInput(p.fechaFin),
          plataforma: p.plataforma,
        });
        if (p.planificacion) {
          this.planificacionForm.patchValue({
            objetivosAcordados: p.planificacion.objetivosAcordados,
            temasAcordados: p.planificacion.temasAcordados,
            metodologia: p.planificacion.metodologia,
            plataforma: p.planificacion.plataforma,
            estado: p.planificacion.estado,
          });
        }
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo cargar el proyecto'));
      },
    });

    // La lista de alumnos la lleva el docente: el agente solo acompaña.
    if (this.esDocente) {
      this.cargarLista();
      this.cargarCertificados();
    }
  }

  // --- Mensajes de la pantalla ---

  /** Cierra el aviso flotante que esté en pantalla. */
  cerrarMensajes(): void {
    this.error.set(null);
    this.ok.set(null);
  }

  /**
   * Cómo va un proceso de confirmaciones **desde el punto de vista del usuario**:
   * si no ha confirmado nadie, si te toca a ti, si faltan otros o si ya está
   * todo. Así no hay que abrir cada reporte para saber en qué punto está.
   */
  estadoConfirmaciones(
    confirmadas: boolean[],
    laMia: boolean,
  ): { texto: string; tono: 'ok' | 'aviso' | 'error' | 'neutro' } {
    const total = confirmadas.length;
    const hechas = confirmadas.filter(Boolean).length;

    if (total === 0) return { texto: 'Sin participantes', tono: 'neutro' };
    if (hechas === total) return { texto: 'Confirmado por todos', tono: 'ok' };
    if (!laMia) {
      return {
        texto:
          hechas === 0
            ? 'Nadie ha confirmado: te toca a ti'
            : `Te toca confirmar (faltan ${total - hechas})`,
        tono: 'error',
      };
    }
    return {
      texto:
        hechas === 0 ? 'Nadie ha confirmado todavía' : `Faltan ${total - hechas} por confirmar`,
      tono: 'aviso',
    };
  }

  /** El estado de las firmas de un reporte de clase. */
  estadoFirmasReporte(reporte: { participaciones?: { confirmadoEn: string | null }[] }): {
    texto: string;
    tono: 'ok' | 'aviso' | 'error' | 'neutro';
  } {
    const participaciones = reporte.participaciones ?? [];
    const mia = this.miParticipacionReporte(
      reporte as Parameters<typeof this.miParticipacionReporte>[0],
    );
    return this.estadoConfirmaciones(
      participaciones.map((parte) => !!parte.confirmadoEn),
      !!mia?.confirmadoEn,
    );
  }

  // --- Lista de alumnos ---

  /** Trae la lista guardada (o `null` si todavía no hay ninguna). */
  cargarLista(): void {
    this.cargandoLista.set(true);
    this.errorLista.set(null);
    this.listasService.obtener(this.proyectoId).subscribe({
      next: (lista) => {
        this.listaAlumnos.set(lista);
        this.cargandoLista.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoLista.set(false);
        this.errorLista.set(extraerMensajeError(err, 'No se pudo cargar la lista de alumnos'));
      },
    });
  }

  /** Lee el archivo elegido y muestra la vista previa (todavía no guarda). */
  leerArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) return;

    this.leyendoLista.set(true);
    this.errorLista.set(null);
    this.avisoLista.set(null);
    this.listasService.previsualizarArchivo(this.proyectoId, archivo).subscribe({
      next: (vista) => {
        this.vistaPrevia.set(vista);
        this.leyendoLista.set(false);
        entrada.value = '';
      },
      error: (err: HttpErrorResponse) => {
        this.leyendoLista.set(false);
        entrada.value = '';
        this.errorLista.set(extraerMensajeError(err, 'No se pudo leer el archivo'));
      },
    });
  }

  /** Lee la lista pegada a mano. */
  leerTextoPegado(): void {
    const texto = this.textoPegado().trim();
    if (!texto) return;

    this.leyendoLista.set(true);
    this.errorLista.set(null);
    this.avisoLista.set(null);
    this.listasService.previsualizarTexto(this.proyectoId, texto).subscribe({
      next: (vista) => {
        this.vistaPrevia.set(vista);
        this.leyendoLista.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.leyendoLista.set(false);
        this.errorLista.set(extraerMensajeError(err, 'No se pudo leer la lista'));
      },
    });
  }

  /** Corrige una celda de la vista previa antes de guardar. */
  editarFila(indice: number, campo: 'nombre' | 'matricula' | 'correo', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.vistaPrevia.update((vista) => {
      if (!vista) return vista;
      return {
        ...vista,
        filas: vista.filas.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila)),
      };
    });
  }

  /** Saca una fila de la vista previa (no toca lo que ya está guardado). */
  quitarFila(indice: number): void {
    this.vistaPrevia.update((vista) =>
      vista ? { ...vista, filas: vista.filas.filter((_, i) => i !== indice) } : vista,
    );
  }

  cancelarVistaPrevia(): void {
    this.vistaPrevia.set(null);
    this.textoPegado.set('');
    this.errorLista.set(null);
    this.avisoLista.set(null);
    this.modoReemplazo.set(false);
  }

  /** Guarda la lista revisada, reemplazando la anterior si la había. */
  guardarLista(): void {
    const vista = this.vistaPrevia();
    if (!vista || vista.filas.length === 0) return;
    if (!this.declaraConsentimientoAlumnos()) {
      this.errorLista.set(
        'Marca la declaración de autorización para cargar los datos de los alumnos.',
      );
      return;
    }

    this.guardandoLista.set(true);
    this.errorLista.set(null);
    this.listasService
      .guardar(
        this.proyectoId,
        vista.origen,
        vista.filas.map((fila) => ({
          nombre: fila.nombre,
          matricula: fila.matricula,
          correo: fila.correo,
        })),
        true,
      )
      .subscribe({
        next: (lista) => {
          this.listaAlumnos.set(lista);
          this.vistaPrevia.set(null);
          this.textoPegado.set('');
          this.modoReemplazo.set(false);
          this.declaraConsentimientoAlumnos.set(false);
          this.guardandoLista.set(false);
          this.avisoLista.set(`Lista guardada: ${lista.resumen.total} alumno(s).`);
          // Los certificados salen de esta lista: la sección se recalcula.
          this.cargarCertificados();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoLista.set(false);
          this.errorLista.set(extraerMensajeError(err, 'No se pudo guardar la lista'));
        },
      });
  }

  /** Muestra el área para subir o pegar una lista nueva. */
  reemplazarLista(): void {
    this.modoReemplazo.set(true);
    this.vistaPrevia.set(null);
    this.avisoLista.set(null);
  }

  /** Entra o saca a un alumno de los certificados, sin borrarlo de la lista. */
  alternarIncluido(alumno: AlumnoLista): void {
    this.errorLista.set(null);
    this.listasService
      .editarAlumno(this.proyectoId, alumno.id, { incluido: !alumno.incluido })
      .subscribe({
        next: (lista) => {
          this.listaAlumnos.set(lista);
          this.cargarCertificados();
        },
        error: (err: HttpErrorResponse) =>
          this.errorLista.set(extraerMensajeError(err, 'No se pudo actualizar al alumno')),
      });
  }

  eliminarAlumno(alumno: AlumnoLista): void {
    this.errorLista.set(null);
    this.listasService.eliminarAlumno(this.proyectoId, alumno.id).subscribe({
      next: (lista) => {
        this.listaAlumnos.set(lista);
        this.avisoLista.set(`${alumno.nombre} salió de la lista.`);
        this.cargarCertificados();
      },
      error: (err: HttpErrorResponse) =>
        this.errorLista.set(extraerMensajeError(err, 'No se pudo quitar al alumno')),
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // --- Certificados ---

  /** Trae el estado de la sección: la plantilla, la lista y lo ya emitido. */
  cargarCertificados(): void {
    this.cargandoCertificados.set(true);
    this.errorCertificados.set(null);
    this.certificadosService.estado(this.proyectoId).subscribe({
      next: (estado) => {
        this.certificadosEstado.set(estado);
        this.cargandoCertificados.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoCertificados.set(false);
        this.errorCertificados.set(
          extraerMensajeError(err, 'No se pudo cargar el estado de los certificados'),
        );
      },
    });
  }

  /**
   * Emite los certificados. Sin `alumnoId`, los de todos los alumnos incluidos;
   * con él, solo el de ese alumno (y entonces sí se permite reemitir, porque el
   * docente lo ha pedido alumno por alumno).
   */
  emitirCertificados(alumnoId?: number, reemitir = false): void {
    if (this.emitiendoCertificados()) return;

    this.emitiendoCertificados.set(true);
    this.errorCertificados.set(null);
    this.avisoCertificados.set(null);
    this.certificadosOmitidos.set([]);

    this.certificadosService.emitir(this.proyectoId, { alumnoId, reemitir }).subscribe({
      next: (resultado) => {
        this.emitiendoCertificados.set(false);
        this.avisoCertificados.set(resultado.mensaje);
        this.certificadosOmitidos.set(resultado.omitidos);
        if (resultado.avisos.length > 0) {
          this.errorCertificados.set(resultado.avisos.join(' '));
        }
        this.cargarCertificados();
      },
      error: (err: HttpErrorResponse) => {
        this.emitiendoCertificados.set(false);
        this.errorCertificados.set(
          extraerMensajeError(err, 'No se pudieron emitir los certificados'),
        );
      },
    });
  }

  /** Descarga el PDF de un certificado. */
  descargarCertificado(certificado: CertificadoEmitido): void {
    if (this.descargandoCertificado() !== null) return;
    this.descargandoCertificado.set(certificado.id);
    this.errorCertificados.set(null);
    this.certificadosService.descargarPdf(this.proyectoId, certificado.id).subscribe({
      next: (blob) => {
        this.descargandoCertificado.set(null);
        descargarBlob(blob, `certificado-${certificado.folio}.pdf`);
        this.avisoCertificados.set(`Certificado ${certificado.folio} descargado`);
      },
      error: (err: HttpErrorResponse) => {
        this.descargandoCertificado.set(null);
        this.errorCertificados.set(extraerMensajeError(err, 'No se pudo descargar el certificado'));
      },
    });
  }

  /** Descarga todos los certificados vigentes en un ZIP. */
  descargarCertificadosZip(): void {
    if (this.descargandoZip()) return;
    this.descargandoZip.set(true);
    this.errorCertificados.set(null);
    this.certificadosService.descargarZip(this.proyectoId).subscribe({
      next: (blob) => {
        this.descargandoZip.set(false);
        descargarBlob(blob, `certificados-clase-espejo-${this.proyectoId}.zip`);
        this.avisoCertificados.set('Certificados descargados en un ZIP');
      },
      error: (err: HttpErrorResponse) => {
        this.descargandoZip.set(false);
        this.errorCertificados.set(extraerMensajeError(err, 'No se pudo descargar el ZIP'));
      },
    });
  }

  /** Pide confirmación antes de reemitir: el anterior queda anulado. */
  reemitirCertificado(certificado: CertificadoEmitido): void {
    this.verCertificados.set(false);
    this.confirmarAccion(
      'Reemitir certificado',
      `Se emitirá un certificado nuevo para ${certificado.alumnoNombre} y el ${certificado.folio} quedará anulado. ¿Continuar?`,
      () => this.emitirCertificados(certificado.alumnoId, true),
    );
  }

  // --- Envío por correo a los alumnos (fase 5) ---

  /**
   * Envía el certificado de un alumno. Sin `reenviar`, a quien ya se le envió
   * no se le manda otra vez: el servidor lo deja fuera y lo explica.
   */
  enviarCertificado(certificado: CertificadoEmitido, reenviar = false): void {
    if (this.enviandoCertificado() !== null) return;

    this.enviandoCertificado.set(certificado.id);
    this.limpiarResultadoEnvio();
    this.errorCertificados.set(null);
    this.avisoCertificados.set(null);

    this.certificadosService.enviarUno(this.proyectoId, certificado.id, reenviar).subscribe({
      next: (resultado) => {
        this.enviandoCertificado.set(null);
        this.mostrarResultadoEnvio(resultado);
        this.cargarCertificados();
      },
      error: (err: HttpErrorResponse) => {
        this.enviandoCertificado.set(null);
        this.errorCertificados.set(extraerMensajeError(err, 'No se pudo enviar el certificado'));
      },
    });
  }

  /**
   * Envía los certificados a **todos** los alumnos de la lista del docente.
   *
   * Los que no tienen correo no rompen el envío: salen listados aparte para
   * añadírselo y volver a intentarlo.
   */
  enviarCertificadosATodos(reenviar = false): void {
    if (this.enviandoTodos()) return;

    this.enviandoTodos.set(true);
    this.limpiarResultadoEnvio();
    this.errorCertificados.set(null);
    this.avisoCertificados.set(null);

    this.certificadosService.enviar(this.proyectoId, { reenviar }).subscribe({
      next: (resultado) => {
        this.enviandoTodos.set(false);
        this.mostrarResultadoEnvio(resultado);
        this.cargarCertificados();
      },
      error: (err: HttpErrorResponse) => {
        this.enviandoTodos.set(false);
        this.errorCertificados.set(
          extraerMensajeError(err, 'No se pudieron enviar los certificados'),
        );
      },
    });
  }

  /** Deja en pantalla la cuenta del envío y lo que quedó pendiente. */
  private mostrarResultadoEnvio(resultado: ResultadoEnvioCertificados): void {
    this.avisoCertificados.set(resultado.mensaje);
    this.envioOmitidos.set(resultado.omitidos);
    this.envioFallidos.set(resultado.fallidos);
    this.envioSinCorreo.set(resultado.sinCorreo);
    if (resultado.loteId) {
      this.seguirLote(resultado.loteId, 'certificados');
    }
  }

  /**
   * Sigue el lote de la cola cada 2 s hasta que termina. Al completarse deja el
   * resultado final en pantalla: cuántos salieron y cuántos fallaron con su
   * motivo. El docente puede cerrar la página: la cola sigue en el servidor.
   */
  private seguirLote(loteId: string, contexto: 'certificados' | 'calendario'): void {
    this.loteSub?.unsubscribe();
    this.loteEnvio.set(loteId);
    this.progresoEnvio.set(null);

    this.loteSub = timer(0, 2000)
      .pipe(
        switchMap(() => this.envios.progreso(loteId)),
        takeWhile((progreso) => !progreso.completado, true),
      )
      .subscribe({
        next: (progreso) => {
          this.progresoEnvio.set(progreso);
          if (!progreso.completado) return;

          const resumen = this.resumenDeLote(progreso, contexto);
          if (contexto === 'certificados') {
            this.avisoCertificados.set(resumen);
            this.cargarCertificados();
          } else if (progreso.fallidos > 0) {
            this.error.set(resumen);
          } else {
            this.ok.set(resumen);
          }
        },
        error: (err: HttpErrorResponse) => {
          const mensaje = extraerMensajeError(err, 'No se pudo consultar el progreso del envío');
          if (contexto === 'certificados') {
            this.errorCertificados.set(mensaje);
          } else {
            this.error.set(mensaje);
          }
        },
      });
  }

  private resumenDeLote(progreso: ProgresoLote, contexto: 'certificados' | 'calendario'): string {
    const cosa =
      contexto === 'certificados'
        ? progreso.total === 1
          ? 'certificado enviado'
          : 'certificados enviados'
        : progreso.total === 1
          ? 'correo enviado'
          : 'correos enviados';
    const base = `Envío completado: ${progreso.enviados} de ${progreso.total} ${cosa}`;
    return progreso.fallidos > 0
      ? `${base}; ${progreso.fallidos} fallaron (mira el detalle).`
      : `${base}.`;
  }

  private limpiarResultadoEnvio(): void {
    this.envioOmitidos.set([]);
    this.envioFallidos.set([]);
    this.envioSinCorreo.set([]);
  }

  // --- Anulación (fase 5) ---

  abrirCertificados(): void {
    this.verCertificados.set(true);
  }

  cerrarCertificados(): void {
    this.verCertificados.set(false);
  }

  /** Abre el cuadro del motivo: la anulación siempre se explica. */
  abrirAnulacion(certificado: CertificadoEmitido): void {
    this.verCertificados.set(false);
    this.motivoAnulacion.set('');
    this.errorAnulacion.set(null);
    this.certificadoAAnular.set(certificado);
  }

  cerrarAnulacion(): void {
    this.certificadoAAnular.set(null);
    this.motivoAnulacion.set('');
    this.errorAnulacion.set(null);
  }

  /**
   * Anula el certificado con el motivo escrito. El PDF se conserva (es un
   * documento histórico), pero la página pública pasa a mostrarlo como anulado.
   */
  confirmarAnulacion(): void {
    const certificado = this.certificadoAAnular();
    const motivo = this.motivoAnulacion().trim();
    if (!certificado || this.anulandoCertificado()) return;

    if (motivo.length < 3) {
      this.errorAnulacion.set(
        'Escribe el motivo de la anulación: quien mire el certificado tiene derecho a saber qué pasó.',
      );
      return;
    }

    this.anulandoCertificado.set(true);
    this.errorAnulacion.set(null);
    this.certificadosService.anular(this.proyectoId, certificado.id, motivo).subscribe({
      next: (r) => {
        this.anulandoCertificado.set(false);
        this.cerrarAnulacion();
        this.avisoCertificados.set(r.mensaje);
        this.cargarCertificados();
      },
      error: (err: HttpErrorResponse) => {
        this.anulandoCertificado.set(false);
        this.errorAnulacion.set(extraerMensajeError(err, 'No se pudo anular el certificado'));
      },
    });
  }

  // --- Enlace de verificación ---

  /**
   * Copia el enlace público del certificado (el mismo que lleva el QR, con su
   * código). Si el navegador no deja usar el portapapeles —pasa cuando la página
   * no va por HTTPS—, se deja el enlace a la vista para copiarlo a mano.
   */
  copiarEnlace(certificado: CertificadoEmitido): void {
    const enlace = certificado.enlaceVerificacion;
    this.errorCertificados.set(null);

    const portapapeles = navigator.clipboard;
    if (!portapapeles?.writeText) {
      this.enlaceCopiado.set(certificado.folio);
      this.avisoCertificados.set(`Copia el enlace a mano: ${enlace}`);
      return;
    }

    portapapeles.writeText(enlace).then(
      () => {
        this.enlaceCopiado.set(certificado.folio);
        this.avisoCertificados.set(`Enlace de verificación del ${certificado.folio} copiado.`);
      },
      () => {
        this.enlaceCopiado.set(certificado.folio);
        this.avisoCertificados.set(`Copia el enlace a mano: ${enlace}`);
      },
    );
  }

  // --- Correo que falta en la lista ---

  /** Lo que el docente lleva escrito para un alumno sin correo. */
  correoDe(alumnoId: number): string {
    return this.correosNuevos()[alumnoId] ?? '';
  }

  cambiarCorreo(alumnoId: number, valor: string): void {
    this.correosNuevos.update((mapa) => ({ ...mapa, [alumnoId]: valor }));
  }

  /**
   * Guarda el correo de un alumno que no lo tenía. Se guarda en la **lista**,
   * que es de donde sale el envío: así el dato queda para las próximas veces y
   * no solo para este envío.
   */
  guardarCorreo(alumnoId: number): void {
    const correo = this.correoDe(alumnoId).trim();
    if (this.guardandoCorreo() !== null) return;

    if (!correo) {
      this.errorLista.set('Escribe el correo antes de guardarlo.');
      return;
    }

    this.guardandoCorreo.set(alumnoId);
    this.errorLista.set(null);
    this.listasService.editarAlumno(this.proyectoId, alumnoId, { correo }).subscribe({
      next: (lista) => {
        this.guardandoCorreo.set(null);
        this.listaAlumnos.set(lista);
        this.correosNuevos.update((mapa) => {
          const copia = { ...mapa };
          delete copia[alumnoId];
          return copia;
        });
        this.avisoLista.set('Correo guardado: ya se le puede enviar el certificado.');
        this.cargarCertificados();
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoCorreo.set(null);
        this.errorLista.set(extraerMensajeError(err, 'No se pudo guardar el correo'));
      },
    });
  }

  /** Etiqueta legible del estado de un certificado. */
  estadoCertificadoLabel(estado: string): string {
    return estado === 'ANULADO' ? 'Anulado' : 'Emitido';
  }

  // --- Proyecto ---

  guardarProyecto(): void {
    if (this.guardandoProyecto() || this.proyectoForm.invalid) return;
    const v = this.proyectoForm.value;
    if (v.fechaInicio && v.fechaFin && v.fechaFin < v.fechaInicio) {
      this.error.set('La fecha de fin no puede ser anterior a la fecha de inicio');
      return;
    }
    this.guardandoProyecto.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos
      .actualizar(this.proyectoId, {
        estado: v.estado ?? undefined,
        fechaInicio: v.fechaInicio ?? undefined,
        fechaFin: v.fechaFin ?? undefined,
        plataforma: v.plataforma ?? undefined,
      })
      .subscribe({
        next: () => {
          this.guardandoProyecto.set(false);
          this.ok.set('Proyecto actualizado');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoProyecto.set(false);
          this.error.set(extraerMensajeError(err, 'Error al actualizar el proyecto'));
        },
      });
  }

  // --- Docentes ---

  agregarDocente(): void {
    const asignacionId = this.asignacionSeleccionada.value;
    if (this.agregandoDocente() || asignacionId == null) return;
    // Sin institución conocida, el rol se guardaría mal (DESTINO por defecto).
    if (this.miInstitucionId() == null) {
      this.error.set(
        'No se pudo determinar tu institución: recarga la página antes de agregar docentes.',
      );
      return;
    }

    this.agregandoDocente.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos
      .agregarDocente(this.proyectoId, {
        asignacionDocenteId: asignacionId,
        rol: this.rolDeInstitucion(),
      })
      .subscribe({
        next: () => {
          this.agregandoDocente.set(false);
          this.asignacionSeleccionada.setValue(null);
          this.ok.set('Docente agregado al proyecto');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.agregandoDocente.set(false);
          this.error.set(extraerMensajeError(err, 'Error al agregar docente'));
        },
      });
  }

  quitarDocente(proyectoDocenteId: number, nombre: string): void {
    this.confirmarAccion('Quitar docente', `¿Quitar a ${nombre} del proyecto?`, () =>
      this.proyectos.quitarDocente(this.proyectoId, proyectoDocenteId).subscribe({
        next: () => {
          this.ok.set('Docente retirado del proyecto');
          this.cargar();
        },
        error: (err: HttpErrorResponse) =>
          this.error.set(extraerMensajeError(err, 'Error al quitar docente')),
      }),
    );
  }

  private rolDeInstitucion(): string {
    const p = this.proyecto();
    const institucionOrigen = p?.solicitud.asignacionOrigen.docenteInstitucion.institucion.id;
    return this.miInstitucionId() === institucionOrigen ? 'ORIGEN' : 'DESTINO';
  }

  // --- Planificación ---

  guardarPlanificacion(): void {
    if (this.guardandoPlanificacion() || this.planificacionForm.invalid) return;
    const v = this.planificacionForm.value;
    this.guardandoPlanificacion.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos
      .guardarPlanificacion(this.proyectoId, {
        objetivosAcordados: v.objetivosAcordados ?? '',
        temasAcordados: v.temasAcordados ?? '',
        metodologia: v.metodologia ?? '',
        plataforma: v.plataforma ?? '',
        estado: v.estado ?? undefined,
      })
      .subscribe({
        next: () => {
          this.guardandoPlanificacion.set(false);
          this.ok.set('Planificación guardada');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoPlanificacion.set(false);
          this.error.set(extraerMensajeError(err, 'Error al guardar la planificación'));
        },
      });
  }

  confirmarParticipacion(): void {
    if (this.confirmando()) return;
    this.confirmando.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos.confirmarParticipacion(this.proyectoId).subscribe({
      next: () => {
        this.confirmando.set(false);
        this.ok.set('Confirmaste tu participación en la planificación');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.confirmando.set(false);
        this.error.set(extraerMensajeError(err, 'Error al confirmar la participación'));
      },
    });
  }

  miParticipacion(): ParticipacionPlanificacion | null {
    const p = this.proyecto();
    if (!p?.planificacion) return null;
    return (
      p.planificacion.participaciones.find(
        (x) =>
          x.proyectoDocente.asignacionDocente.docenteInstitucion.docente.usuario.id ===
          this.usuario?.id,
      ) ?? null
    );
  }

  // --- Reporte ---

  generarReporte(): void {
    if (this.generandoReporte()) return;
    const v = this.reporteForm.value;
    this.generandoReporte.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos
      .generarReporte(this.proyectoId, {
        vistoBueno: v.vistoBueno ?? true,
        observaciones: v.observaciones ?? '',
      })
      .subscribe({
        next: () => {
          this.generandoReporte.set(false);
          this.reporteForm.reset({ vistoBueno: true, observaciones: '' });
          this.ok.set('Acta de supervisión guardada');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.generandoReporte.set(false);
          this.error.set(extraerMensajeError(err, 'Error al guardar el acta'));
        },
      });
  }

  // --- Sesiones, actividades y evidencias (Semana 6) ---

  cargarSesiones(): void {
    this.proyectos.listarSesiones(this.proyectoId).subscribe({
      next: (r) => this.sesiones.set(r),
      error: (err: HttpErrorResponse) => {
        this.sesiones.set([]);
        this.avisarErrorCarga(err, 'No se pudieron cargar las sesiones');
      },
    });
  }

  crearSesion(): void {
    if (this.guardandoSesion() || this.sesionForm.invalid) return;
    const v = this.sesionForm.value;
    this.guardandoSesion.set(true);
    this.error.set(null);
    this.proyectos
      .crearSesion(this.proyectoId, {
        titulo: v.titulo ?? '',
        // El campo viene en la zona del navegador; la API guarda el instante.
        fechaHora: instanteDesdeLocal(v.fechaHora ?? ''),
        enlaceVirtual: v.enlaceVirtual ?? '',
      })
      .subscribe({
        next: () => {
          this.guardandoSesion.set(false);
          this.sesionForm.reset();
          this.ok.set('Sesión creada');
          this.cargarSesiones();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoSesion.set(false);
          this.error.set(extraerMensajeError(err, 'Error al crear la sesión'));
        },
      });
  }

  eliminarSesion(id: number): void {
    this.confirmarAccion('Eliminar sesión', '¿Eliminar esta sesión?', () =>
      this.proyectos.eliminarSesion(this.proyectoId, id).subscribe({
        next: () => this.cargarSesiones(),
        error: (err: HttpErrorResponse) =>
          this.error.set(extraerMensajeError(err, 'Error al eliminar la sesión')),
      }),
    );
  }

  cargarActividades(): void {
    this.proyectos.listarActividades(this.proyectoId).subscribe({
      next: (r) => this.actividades.set(r),
      error: (err: HttpErrorResponse) => {
        this.actividades.set([]);
        this.avisarErrorCarga(err, 'No se pudieron cargar las actividades');
      },
    });
  }

  crearActividad(): void {
    if (this.guardandoActividad() || this.actividadForm.invalid) return;
    const v = this.actividadForm.value;
    this.guardandoActividad.set(true);
    this.error.set(null);
    this.proyectos
      .crearActividad(this.proyectoId, {
        titulo: v.titulo ?? '',
        instrucciones: v.instrucciones ?? '',
        fechaLimite: v.fechaLimite ?? '',
      })
      .subscribe({
        next: () => {
          this.guardandoActividad.set(false);
          this.actividadForm.reset();
          this.ok.set('Actividad creada');
          this.cargarActividades();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoActividad.set(false);
          this.error.set(extraerMensajeError(err, 'Error al crear la actividad'));
        },
      });
  }

  eliminarActividad(id: number): void {
    this.confirmarAccion('Eliminar actividad', '¿Eliminar esta actividad?', () =>
      this.proyectos.eliminarActividad(this.proyectoId, id).subscribe({
        next: () => this.cargarActividades(),
        error: (err: HttpErrorResponse) =>
          this.error.set(extraerMensajeError(err, 'Error al eliminar la actividad')),
      }),
    );
  }

  cargarEvidencias(): void {
    this.proyectos.listarEvidencias(this.proyectoId).subscribe({
      next: (r) => this.evidencias.set(r),
      error: (err: HttpErrorResponse) => {
        this.evidencias.set([]);
        this.avisarErrorCarga(err, 'No se pudieron cargar las evidencias');
      },
    });
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.item(0) ?? null;
    if (archivo && archivo.size > 10 * 1024 * 1024) {
      this.error.set('El archivo supera el límite de 10 MB');
      this.archivoSeleccionado.set(null);
      input.value = '';
      return;
    }
    this.archivoSeleccionado.set(archivo);
  }

  cambiarModoEvidencia(modo: 'ARCHIVO' | 'ENLACE'): void {
    this.modoEvidencia.set(modo);
    if (modo === 'ARCHIVO') {
      this.evidenciaForm.controls.enlaceUrl.setValue('');
    } else {
      this.archivoSeleccionado.set(null);
    }
  }

  puedeGuardarEvidencia(): boolean {
    if (this.subiendoEvidencia()) return false;
    if (this.modoEvidencia() === 'ARCHIVO') {
      return this.archivoSeleccionado() !== null;
    }
    return (this.evidenciaForm.controls.enlaceUrl.value ?? '').trim().length > 0;
  }

  crearEvidencia(): void {
    const v = this.evidenciaForm.value;
    const enlace = (v.enlaceUrl ?? '').trim();
    const archivo = this.modoEvidencia() === 'ARCHIVO' ? this.archivoSeleccionado() : null;
    if (this.modoEvidencia() === 'ARCHIVO' && !archivo) {
      this.error.set('Selecciona un archivo de evidencia');
      return;
    }
    if (this.modoEvidencia() === 'ENLACE' && !enlace) {
      this.error.set('Pega un enlace de evidencia');
      return;
    }
    if (this.subiendoEvidencia()) return;

    this.subiendoEvidencia.set(true);
    this.error.set(null);
    this.proyectos
      .crearEvidencia(
        this.proyectoId,
        archivo,
        v.tipo ?? '',
        v.sesionId ?? undefined,
        this.modoEvidencia() === 'ENLACE' ? enlace : undefined,
      )
      .subscribe({
        next: () => {
          this.subiendoEvidencia.set(false);
          this.evidenciaForm.reset();
          this.archivoSeleccionado.set(null);
          this.ok.set('Evidencia registrada');
          this.cargarEvidencias();
        },
        error: (err: HttpErrorResponse) => {
          this.subiendoEvidencia.set(false);
          this.error.set(extraerMensajeError(err, 'Error al registrar la evidencia'));
        },
      });
  }

  // En desarrollo (frontend en :4200) el archivo vive en el backend (:3000).
  urlArchivo(url: string | null): string {
    return url ? (urlDeArchivo(url) ?? '') : '';
  }

  nombreArchivo(url: string | null): string {
    return url ? (url.split('/').pop() ?? url) : '';
  }

  /** Etiqueta legible del proveedor del enlace (sin hacer peticiones). */
  proveedorEnlace(url: string | null): string {
    if (!url) return '';
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.endsWith('youtube.com') || host.endsWith('youtu.be')) {
        return 'YouTube';
      }
      if (host.endsWith('vimeo.com')) return 'Vimeo';
      if (host === 'drive.google.com') return 'Google Drive';
      if (host === '1drv.ms' || host.endsWith('onedrive.live.com')) {
        return 'OneDrive';
      }
    } catch {
      // Un enlace viejo o inválido se muestra sin proveedor.
    }
    return 'Enlace';
  }

  tituloSesion(sesionId: number | null): string {
    if (sesionId == null) return 'Sin sesión';
    return this.sesiones().find((s) => s.id === sesionId)?.titulo ?? 'Sesión';
  }

  // --- Reporte de clase, evaluación final y cierre (Semana 7) ---

  cargarReportesClase(): void {
    this.proyectos.listarReportesClase(this.proyectoId).subscribe({
      next: (r) => this.reportesClase.set(r),
      error: (err: HttpErrorResponse) => {
        this.reportesClase.set([]);
        this.avisarErrorCarga(err, 'No se pudieron cargar los reportes de clase');
      },
    });
  }

  cargarEvaluaciones(): void {
    this.proyectos.listarEvaluaciones(this.proyectoId).subscribe({
      next: (r) => this.evaluaciones.set(r),
      error: (err: HttpErrorResponse) => {
        this.evaluaciones.set([]);
        this.avisarErrorCarga(err, 'No se pudo cargar la evaluación final');
      },
    });
  }

  private avisarErrorCarga(err: HttpErrorResponse, contexto: string): void {
    this.error.set(`${contexto}: ${extraerMensajeError(err, 'error de conexión')}`);
  }

  reporteDeSesion(sesionId: number): ReporteClase | null {
    return this.reportesClase().find((r) => r.sesionId === sesionId) ?? null;
  }

  miParticipacionReporte(reporte: ReporteClase): ParticipacionReporte | null {
    return (
      reporte.participaciones.find(
        (p) =>
          p.proyectoDocente.asignacionDocente.docenteInstitucion.docente.usuario.id ===
          this.usuario?.id,
      ) ?? null
    );
  }

  abrirReporte(sesion: Sesion): void {
    const reporte = this.reporteDeSesion(sesion.id);
    this.reporteClaseForm.reset({
      desarrolloClase: reporte?.desarrolloClase ?? '',
      totalAsistentes: reporte?.totalAsistentes ?? 0,
      incidencias: reporte?.incidencias ?? '',
      acuerdosSiguienteSesion: reporte?.acuerdosSiguienteSesion ?? '',
    });
    this.error.set(null);
    this.sesionReporteAbierta.set(sesion.id);
  }

  cerrarReporte(): void {
    this.sesionReporteAbierta.set(null);
  }

  guardarReporteClase(): void {
    const sesionId = this.sesionReporteAbierta();
    if (sesionId == null || this.guardandoReporteClase() || this.reporteClaseForm.invalid) {
      return;
    }
    const v = this.reporteClaseForm.value;
    this.guardandoReporteClase.set(true);
    this.error.set(null);
    this.proyectos
      .guardarReporteClase(this.proyectoId, sesionId, {
        desarrolloClase: v.desarrolloClase ?? '',
        totalAsistentes: Number(v.totalAsistentes ?? 0),
        incidencias: v.incidencias ?? '',
        acuerdosSiguienteSesion: v.acuerdosSiguienteSesion ?? '',
      })
      .subscribe({
        next: () => {
          this.guardandoReporteClase.set(false);
          this.sesionReporteAbierta.set(null);
          this.ok.set('Reporte de clase guardado');
          this.cargarReportesClase();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoReporteClase.set(false);
          this.error.set(extraerMensajeError(err, 'Error al guardar el reporte de clase'));
        },
      });
  }

  abrirConfirmacion(reporte: ReporteClase): void {
    const mia = this.miParticipacionReporte(reporte);
    this.observacionesForm.reset({ observaciones: mia?.observaciones ?? '' });
    this.error.set(null);
    this.reporteAConfirmar.set(reporte.id);
  }

  cancelarConfirmacion(): void {
    this.reporteAConfirmar.set(null);
  }

  confirmarReporte(reporte: ReporteClase): void {
    if (this.confirmandoReporteClase() || this.observacionesForm.invalid) {
      return;
    }
    const observaciones = this.observacionesForm.value.observaciones ?? '';
    this.confirmandoReporteClase.set(true);
    this.error.set(null);
    this.proyectos.confirmarReporteClase(this.proyectoId, reporte.id, observaciones).subscribe({
      next: () => {
        this.confirmandoReporteClase.set(false);
        this.reporteAConfirmar.set(null);
        this.ok.set('Participación confirmada en el reporte');
        this.cargarReportesClase();
      },
      error: (err: HttpErrorResponse) => {
        this.confirmandoReporteClase.set(false);
        this.error.set(extraerMensajeError(err, 'Error al confirmar el reporte'));
      },
    });
  }

  crearEvaluacion(): void {
    if (this.guardandoEvaluacion() || this.evaluacionForm.invalid) return;
    const v = this.evaluacionForm.value;
    this.guardandoEvaluacion.set(true);
    this.error.set(null);
    this.proyectos
      .crearEvaluacion(this.proyectoId, {
        instrumento: v.instrumento ?? '',
        resultado: v.resultado ?? '',
        observaciones: v.observaciones ?? '',
      })
      .subscribe({
        next: () => {
          this.guardandoEvaluacion.set(false);
          this.evaluacionForm.reset({
            instrumento: '',
            resultado: '',
            observaciones: '',
          });
          this.ok.set('Evaluación final registrada');
          this.cargarEvaluaciones();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoEvaluacion.set(false);
          this.error.set(extraerMensajeError(err, 'Error al registrar la evaluación'));
        },
      });
  }

  /** Descarga el resumen de la clase en PDF para el registro físico. */
  descargarResumenPdf(): void {
    if (this.descargandoResumenPdf()) return;
    this.descargandoResumenPdf.set(true);
    this.error.set(null);
    this.proyectos.descargarResumenPdf(this.proyectoId).subscribe({
      next: (blob) => {
        this.descargandoResumenPdf.set(false);
        descargarBlob(blob, `clase-espejo-${this.proyectoId}.pdf`);
        this.ok.set('Resumen PDF descargado');
      },
      error: (err: HttpErrorResponse) => {
        this.descargandoResumenPdf.set(false);
        this.error.set(extraerMensajeError(err, 'Error al descargar el resumen PDF'));
      },
    });
  }

  /**
   * Descarga el archivo `.ics` de la clase espejo para abrirlo con el calendario
   * de cada quien. La plataforma no avisa de nada: son los recordatorios que van
   * dentro del archivo (60, 30 y 15 minutos antes) los que hacen que el
   * calendario del usuario le avise.
   */
  descargarCalendario(): void {
    if (this.descargandoCalendario()) return;
    this.descargandoCalendario.set(true);
    this.error.set(null);
    this.proyectos.descargarCalendario(this.proyectoId).subscribe({
      next: (respuesta) => {
        this.descargandoCalendario.set(false);
        const blob = respuesta.body;
        if (!blob) {
          this.error.set('El calendario llegó vacío');
          return;
        }
        descargarBlob(
          blob,
          this.nombreArchivoCalendario(respuesta.headers.get('Content-Disposition')),
        );
        this.ok.set('Calendario descargado: ábrelo para añadirlo');
      },
      error: (err: HttpErrorResponse) => {
        this.descargandoCalendario.set(false);
        this.error.set(extraerMensajeError(err, 'Error al descargar el calendario'));
      },
    });
  }

  /** Nombre que manda el servidor; si no llega, uno razonable. */
  private nombreArchivoCalendario(cabecera: string | null): string {
    const nombre = /filename="?([^";]+)"?/i.exec(cabecera ?? '')?.[1]?.trim();
    return nombre || `clase-espejo-${this.proyectoId}.ics`;
  }

  /**
   * Manda el calendario por correo a los docentes participantes.
   *
   * La plataforma no programa recordatorios: el archivo `.ics` los lleva dentro
   * (1 hora, 30 y 15 minutos antes) y quien avisa es el calendario de cada
   * quien. Este envío es la vía cómoda; la descarga sigue disponible al lado.
   *
   * El resultado no se resuelve con un «enviado» genérico: se guarda el informe
   * completo (`envioCalendario`) para poder enseñar a quién le llegó y a quién
   * no, con el motivo del fallo.
   */
  enviarCalendarioPorCorreo(): void {
    if (this.enviandoCalendario()) return;
    this.enviandoCalendario.set(true);
    this.error.set(null);
    this.ok.set(null);
    this.envioCalendario.set(null);
    this.proyectos.enviarCalendario(this.proyectoId).subscribe({
      next: (resultado) => {
        this.enviandoCalendario.set(false);
        this.envioCalendario.set(resultado);
        if (resultado.loteId) {
          this.ok.set(
            resultado.mensaje ??
              'El calendario quedó en cola. Puedes cerrar la pantalla: se envía igual y verás el progreso aquí.',
          );
          this.seguirLote(resultado.loteId, 'calendario');
          return;
        }
        const enviados = resultado.enviados.length;
        const fallidos = resultado.fallidos.length;
        if (fallidos === 0) {
          this.ok.set(
            `Calendario enviado a ${enviados} ${enviados === 1 ? 'docente' : 'docentes'}.`,
          );
        } else if (enviados === 0) {
          this.error.set(
            'No se pudo enviar el calendario a ningún docente: mira el detalle del envío.',
          );
        } else {
          this.ok.set(
            `Calendario enviado a ${enviados} de ${resultado.total} docentes; ${fallidos} falló. Mira el detalle.`,
          );
        }
      },
      error: (err: HttpErrorResponse) => {
        this.enviandoCalendario.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo enviar el calendario por correo'));
      },
    });
  }

  /** Cierra el informe del último envío (la «x» del detalle). */
  cerrarEnvioCalendario(): void {
    this.envioCalendario.set(null);
  }

  cerrarProyecto(): void {
    this.confirmarAccion(
      'Cerrar clase espejo',
      '¿Cerrar la clase espejo? El proyecto pasará al estado Finalizado.',
      () => {
        this.cerrando.set(true);
        this.error.set(null);
        this.ok.set(null);
        this.proyectos.cerrarProyecto(this.proyectoId).subscribe({
          next: () => {
            this.cerrando.set(false);
            this.ok.set('Clase espejo finalizada');
            this.cargar();
          },
          error: (err: HttpErrorResponse) => {
            this.cerrando.set(false);
            this.error.set(extraerMensajeError(err, 'Error al cerrar la clase espejo'));
          },
        });
      },
    );
  }

  estadoReporteLabel(estado: string): string {
    const labels: Record<string, string> = {
      BORRADOR: 'Borrador',
      EN_REVISION: 'En revisión',
      CONFIRMADO: 'Confirmado',
    };
    return labels[estado] ?? estado;
  }

  /** Un proyecto cerrado queda en solo lectura. */
  proyectoAbierto(): boolean {
    const p = this.proyecto();
    return !!p && p.estado !== 'FINALIZADO' && p.estado !== 'CANCELADO';
  }

  confirmarAccion(titulo: string, mensaje: string, accion: () => void): void {
    this.confirmacion.set({ titulo, mensaje, accion });
  }

  cerrarConfirmacion(): void {
    this.confirmacion.set(null);
  }

  ejecutarConfirmacion(): void {
    const c = this.confirmacion();
    this.confirmacion.set(null);
    c?.accion();
  }

  // --- Helpers de presentación ---

  nombreDocente(item: {
    asignacionDocente: {
      docenteInstitucion: {
        docente: {
          usuario: {
            nombres: string;
            apellidoPaterno: string;
            apellidoMaterno: string;
          };
        };
      };
    };
  }): string {
    const u = item.asignacionDocente.docenteInstitucion.docente.usuario;
    return `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`;
  }

  nombreAutor(m: Mensaje): string {
    const u = m.autor.asignacionDocente.docenteInstitucion.docente.usuario;
    return `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`;
  }

  esMio(m: Mensaje): boolean {
    return m.autor.asignacionDocente.docenteInstitucion.docente.usuario.id === this.usuario?.id;
  }

  iniciales(m: Mensaje): string {
    const u = m.autor.asignacionDocente.docenteInstitucion.docente.usuario;
    return `${u.nombres.charAt(0)}${u.apellidoPaterno.charAt(0)}`.toUpperCase();
  }

  horaDe(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  /** Etiqueta del estado de una clase espejo (catálogo compartido). */
  readonly estadoProyectoLabel = etiquetaEstadoProyecto;

  estadoPlanificacionLabel(estado: string): string {
    const labels: Record<string, string> = {
      BORRADOR: 'Borrador',
      EN_REVISION: 'En revisión',
      APROBADA: 'Aprobada',
    };
    return labels[estado] ?? estado;
  }

  estadoParticipacionLabel(estatus: string): string {
    return estatus === 'CONFIRMADA' ? 'Confirmada' : 'Pendiente';
  }

  /** Día de calendario, legible y sin desfase de zona. */
  formatearFecha(fecha: string | null): string {
    return fecha ? fechaLarga(fecha) : '—';
  }

  /** Valor para un `<input type="date">`: el día tal como lo guarda el backend. */
  private aFechaInput(fecha: string): string {
    return fechaTexto(fecha);
  }
}
