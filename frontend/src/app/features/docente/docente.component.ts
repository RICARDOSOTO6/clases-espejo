import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { SolicitudesService } from '../../core/services/solicitudes.service';
import { InstitucionesService } from '../../core/services/instituciones.service';
import { ProyectosService } from '../../core/services/proyectos.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { Institucion, Perfil } from '../../core/models/auth.models';
import { PAISES, PAISES_CACE } from '../../core/constants/catalogos';
import { Materia } from '../../core/models/materia.models';
import {
  AsignacionMia,
  CreateSolicitudDto,
  Solicitud,
} from '../../core/models/solicitud.models';
import { Proyecto } from '../../core/models/proyecto.models';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import {
  PendienteUi,
  UiStateService,
} from '../../core/services/ui-state.service';

@Component({
  selector: 'app-docente',
  imports: [ReactiveFormsModule, ModalComponent, RouterLink, LayoutComponent],
  templateUrl: './docente.component.html',
})
export class DocenteComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly solicitudesService = inject(SolicitudesService);
  private readonly institucionesService = inject(InstitucionesService);
  private readonly proyectosService = inject(ProyectosService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  /** Estado compartido con el esqueleto (buscador, campana y contadores). */
  readonly ui = inject(UiStateService);

  usuario = this.auth.currentUser();
  readonly paisesComunidad = PAISES_CACE;

  /** Nombre completo para la navbar. */
  get nombreUsuario(): string {
    const u = this.usuario;
    return u ? `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}` : '';
  }

  /** Bandera del país del usuario para la navbar. */
  get banderaUrl(): string | null {
    const p = this.paisUsuario();
    return p ? this.flagUrl(p.codigo) : null;
  }

  get banderaAlt(): string {
    return this.paisUsuario()?.nombre ?? '';
  }

  asignaciones = signal<AsignacionMia[]>([]);
  instituciones = signal<Institucion[]>([]);
  materiasDestino = signal<Materia[]>([]);
  solicitudes = signal<Solicitud[]>([]);
  proyectos = signal<Proyecto[]>([]);
  paisUsuario = signal<{ codigo: string; nombre: string } | null>(null);

  /** Solicitudes que pasan el filtro del buscador de la barra superior. */
  readonly solicitudesFiltradas = computed(() =>
    this.solicitudes().filter((s) =>
      this.ui.coincide(
        s.titulo,
        s.objetivo,
        s.institucionDestino?.nombre,
        s.asignacionOrigen?.materia?.nombre,
      ),
    ),
  );

  /** Clases espejo que pasan el filtro del buscador. */
  readonly proyectosFiltrados = computed(() =>
    this.proyectos().filter((p) =>
      this.ui.coincide(
        p.solicitud?.titulo,
        p.solicitud?.institucionDestino?.nombre,
        p.solicitud?.asignacionOrigen?.docenteInstitucion?.institucion?.nombre,
        p.solicitud?.asignacionOrigen?.materia?.nombre,
        this.estadoProyectoLabel(p.estado),
      ),
    ),
  );

  /** Avisos y confirmaciones con el mismo estilo que el resto de la aplicación. */
  avisoPanel = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  confirmacion = signal<{
    titulo: string;
    mensaje: string;
    accion: () => void;
  } | null>(null);

  // --- Modal solicitud ---
  showSolicitudModal = false;
  editandoSolicitud: Solicitud | null = null;
  solicitudLoading = signal(false);
  solicitudError = signal<string | null>(null);

  solicitudForm = this.fb.group({
    asignacionOrigenId: this.fb.control<number | null>(
      null,
      Validators.required,
    ),
    institucionDestinoId: this.fb.control<number | null>(
      null,
      Validators.required,
    ),
    materiaDestinoId: this.fb.control<number | null>(null),
    titulo: ['', Validators.required],
    objetivo: ['', Validators.required],
    fechaPropuesta: ['', Validators.required],
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.auth.getPerfil().subscribe({
      next: (perfil) => this.establecerPaisDesdePerfil(perfil),
      error: () => {},
    });
    this.solicitudesService.misAsignaciones().subscribe({
      next: (r) => {
        this.asignaciones.set(r);
        if (!this.paisUsuario()) {
          this.establecerPais(
            r[0]?.docenteInstitucion?.institucion?.codigoPais,
          );
        }
      },
      error: () => this.asignaciones.set([]),
    });
    this.institucionesService.listar().subscribe({
      next: (r) => this.instituciones.set(r),
      error: () => this.instituciones.set([]),
    });
    this.solicitudesService.listarMias().subscribe({
      next: (r) => {
        this.solicitudes.set(r);
        this.publicarEnLayout();
      },
      error: (err: HttpErrorResponse) => {
        this.solicitudes.set([]);
        this.publicarEnLayout();
        this.avisar(
          'error',
          `No se pudieron cargar tus solicitudes: ${extraerMensajeError(err, 'error de conexión')}`,
        );
      },
    });
    this.proyectosService.listarMios().subscribe({
      next: (r) => {
        this.proyectos.set(r);
        this.publicarEnLayout();
      },
      error: (err: HttpErrorResponse) => {
        this.proyectos.set([]);
        this.publicarEnLayout();
        this.avisar(
          'error',
          `No se pudieron cargar tus proyectos: ${extraerMensajeError(err, 'error de conexión')}`,
        );
      },
    });
  }

  reintentarCarga(): void {
    this.cerrarAviso();
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    // Al salir de la pantalla no se dejan pendientes ni búsqueda de otro panel.
    this.ui.limpiarPantalla();
  }

  /**
   * Publica en el esqueleto lo que el usuario tiene pendiente: contadores del
   * menú lateral, avisos de la campana y clases espejo con chat.
   */
  private publicarEnLayout(): void {
    const solicitudes = this.solicitudes();
    const proyectos = this.proyectos();
    const activos = proyectos.filter(
      (p) => p.estado === 'EN_PLANIFICACION' || p.estado === 'EN_CURSO',
    );

    this.ui.publicarContadores({
      solicitudes: this.pendientes(),
      proyectos: activos.length,
    });

    const avisos: PendienteUi[] = [];
    if (this.pendientes() > 0) {
      avisos.push({
        titulo: `${this.pendientes()} solicitud(es) sin resolver`,
        detalle: 'Están pendientes de revisión por las instituciones.',
        ancla: 'solicitudes',
        tono: 'aviso',
      });
    }
    if (this.aprobadas() > 0) {
      avisos.push({
        titulo: `${this.aprobadas()} clase(s) espejo aprobada(s)`,
        detalle: 'Completa la planificación conjunta.',
        ancla: 'proyectos',
        tono: 'ok',
      });
    }
    const enCurso = proyectos.filter((p) => p.estado === 'EN_CURSO').length;
    if (enCurso > 0) {
      avisos.push({
        titulo: `${enCurso} clase(s) espejo en curso`,
        detalle: 'Registra la sesión y firma su reporte de clase.',
        ancla: 'proyectos',
        tono: 'ok',
      });
    }
    this.ui.publicarPendientes(avisos);

    this.ui.publicarChats(
      activos.map((p) => ({
        id: p.id,
        titulo: p.solicitud?.titulo ?? `Clase espejo #${p.id}`,
        detalle: `${p.solicitud?.asignacionOrigen?.docenteInstitucion?.institucion?.nombre ?? ''} → ${p.solicitud?.institucionDestino?.nombre ?? ''}`,
      })),
    );
  }

  private establecerPaisDesdePerfil(perfil: Perfil): void {
    const entradas = perfil.docente?.instituciones ?? [];
    const entrada = entradas.find((i) => i.activo) ?? entradas[0];
    this.establecerPais(entrada?.institucion?.codigoPais);
  }

  private establecerPais(codigo: string | undefined): void {
    if (!codigo || this.paisUsuario()) return;
    const pais = PAISES.find((p) => p.codigo === codigo);
    if (pais) {
      this.paisUsuario.set({ codigo: pais.codigo, nombre: pais.nombre });
    }
  }

  flagUrl(codigo: string): string {
    return `https://flagcdn.com/w40/${codigo.toLowerCase()}.png`;
  }

  pendientes(): number {
    return this.solicitudes().filter(
      (s) => s.estado === 'PENDIENTE' || s.estado === 'APROBADA_POR_ORIGEN',
    ).length;
  }

  aprobadas(): number {
    return this.solicitudes().filter((s) => s.estado === 'APROBADA').length;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  onDestinoChange(): void {
    this.cargarMateriasDestino(
      this.solicitudForm.get('institucionDestinoId')?.value ?? null,
      false,
    );
  }

  /**
   * Recarga las materias de la institución destino. Con `conservarSeleccion`
   * (al editar) NO borra la materia ya elegida: antes, cualquier edición
   * eliminaba la materia destino sin avisar.
   */
  private cargarMateriasDestino(
    destinoId: number | null,
    conservarSeleccion: boolean,
  ): void {
    const seleccionada =
      this.solicitudForm.get('materiaDestinoId')?.value ?? null;
    this.materiasDestino.set([]);
    if (!conservarSeleccion) {
      this.solicitudForm.patchValue({ materiaDestinoId: null });
    }
    if (destinoId == null) return;

    this.institucionesService.listarMaterias(destinoId).subscribe({
      next: (r) => {
        this.materiasDestino.set(r);
        // Si la materia guardada ya no pertenece a esta institución, se limpia.
        if (
          conservarSeleccion &&
          seleccionada != null &&
          !r.some((m) => m.id === seleccionada)
        ) {
          this.solicitudForm.patchValue({ materiaDestinoId: null });
        }
      },
      error: () => this.materiasDestino.set([]),
    });
  }

  openNueva(): void {
    this.editandoSolicitud = null;
    this.solicitudForm.reset({
      asignacionOrigenId: null,
      institucionDestinoId: null,
      materiaDestinoId: null,
      titulo: '',
      objetivo: '',
      fechaPropuesta: '',
    });
    this.materiasDestino.set([]);
    this.solicitudError.set(null);
    this.showSolicitudModal = true;
  }

  openEditar(s: Solicitud): void {
    this.editandoSolicitud = s;
    this.solicitudForm.patchValue({
      asignacionOrigenId: s.asignacionOrigen.id,
      institucionDestinoId: s.institucionDestino.id,
      materiaDestinoId: s.materiaDestino?.id ?? null,
      titulo: s.titulo,
      objetivo: s.objetivo,
      fechaPropuesta: this.formatearFecha(s.fechaPropuesta),
    });
    this.solicitudError.set(null);
    this.showSolicitudModal = true;
    // Recarga las materias destino conservando la que la solicitud ya tenía.
    this.cargarMateriasDestino(s.institucionDestino.id, true);
  }

  closeSolicitudModal(): void {
    this.showSolicitudModal = false;
  }

  submitSolicitud(): void {
    if (this.solicitudLoading()) return;
    if (this.solicitudForm.invalid) return;

    const v = this.solicitudForm.value;
    if (v.asignacionOrigenId == null || v.institucionDestinoId == null) return;

    const hoy = new Date();
    const hoyTexto = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    if ((v.fechaPropuesta ?? '') < hoyTexto) {
      this.solicitudError.set('La fecha propuesta no puede estar en el pasado');
      return;
    }

    const dto: CreateSolicitudDto = {
      asignacionOrigenId: v.asignacionOrigenId,
      institucionDestinoId: v.institucionDestinoId,
      materiaDestinoId: v.materiaDestinoId ?? null,
      titulo: (v.titulo ?? '').trim(),
      objetivo: (v.objetivo ?? '').trim(),
      fechaPropuesta: v.fechaPropuesta ?? '',
    };

    this.solicitudLoading.set(true);
    this.solicitudError.set(null);

    const req = this.editandoSolicitud
      ? this.solicitudesService.actualizar(this.editandoSolicitud.id, dto)
      : this.solicitudesService.crear(dto);

    req.subscribe({
      next: () => {
        this.solicitudLoading.set(false);
        this.showSolicitudModal = false;
        this.cargarDatos();
      },
      error: (err: HttpErrorResponse) => {
        this.solicitudLoading.set(false);
        this.solicitudError.set(
          extraerMensajeError(err, 'Error al guardar la solicitud'),
        );
      },
    });
  }

  cancelarSolicitud(s: Solicitud): void {
    this.confirmarAccion(
      'Cancelar solicitud',
      `¿Cancelar la solicitud "${s.titulo}"?`,
      () =>
        this.solicitudesService.cancelar(s.id).subscribe({
          next: () => {
            this.avisar('ok', 'Solicitud cancelada');
            this.cargarDatos();
          },
          error: (err: HttpErrorResponse) =>
            this.avisar(
              'error',
              extraerMensajeError(err, 'Error al cancelar la solicitud'),
            ),
        }),
    );
  }

  avisar(tipo: 'ok' | 'error', texto: string): void {
    this.avisoPanel.set({ tipo, texto });
  }

  cerrarAviso(): void {
    this.avisoPanel.set(null);
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

  // --- Helpers ---
  nombreAsignacion(a: AsignacionMia): string {
    return `${a.materia.nombre} · ${a.periodoEscolar}`;
  }

  estadoLabel(s: Solicitud): string {
    switch (s.estado) {
      case 'PENDIENTE':
        return 'Pendiente';
      case 'APROBADA_POR_ORIGEN':
        return 'Aprobada por origen';
      case 'APROBADA':
        return 'Aprobada';
      case 'RECHAZADA':
        return 'Rechazada';
      default:
        return s.estado;
    }
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '';
    // Fecha local: `toISOString()` es UTC y podía devolver el día siguiente.
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  estadoProyectoLabel(estado: string): string {
    const labels: Record<string, string> = {
      EN_PLANIFICACION: 'En planificación',
      EN_CURSO: 'En curso',
      FINALIZADO: 'Finalizado',
      CANCELADO: 'Cancelado',
    };
    return labels[estado] ?? estado;
  }
}
