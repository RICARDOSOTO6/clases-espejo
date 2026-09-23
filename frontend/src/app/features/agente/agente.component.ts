import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { AgentesService } from '../../core/services/agentes.service';
import { MateriasService } from '../../core/services/materias.service';
import { InstitucionesService } from '../../core/services/instituciones.service';
import { SolicitudesService } from '../../core/services/solicitudes.service';
import { ProyectosService } from '../../core/services/proyectos.service';
import { Institucion, InviteDocenteDto } from '../../core/models/auth.models';
import {
  RevisarSolicitudDto,
  SolicitudEntrante,
} from '../../core/models/solicitud.models';
import {
  PAISES,
  PAISES_CACE,
  PERIODOS_ESCOLARES,
  PROGRAMAS_EDUCATIVOS,
} from '../../core/constants/catalogos';
import {
  Asignacion,
  DocenteInstitucion,
  Materia,
} from '../../core/models/materia.models';
import { Proyecto } from '../../core/models/proyecto.models';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { LayoutComponent } from '../../shared/components/layout/layout.component';

@Component({
  selector: 'app-agente',
  imports: [ReactiveFormsModule, ModalComponent, RouterLink, LayoutComponent],
  templateUrl: './agente.component.html',
})
export class AgenteComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly agentes = inject(AgentesService);
  private readonly materiasService = inject(MateriasService);
  private readonly institucionesService = inject(InstitucionesService);
  private readonly solicitudesService = inject(SolicitudesService);
  private readonly proyectosService = inject(ProyectosService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  usuario = this.auth.currentUser();

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

  // --- Invitar docente ---
  showInviteModal = false;
  inviteLoading = signal(false);
  inviteError = signal<string | null>(null);
  inviteSuccess = signal<string | null>(null);

  inviteForm = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    numeroEmpleado: ['', Validators.required],
  });

  // --- Datos ---
  docentes = signal<DocenteInstitucion[]>([]);
  materias = signal<Materia[]>([]);
  asignaciones = signal<Asignacion[]>([]);
  institucion = signal<Institucion | null>(null);
  institucionCargada = signal(false);

  readonly paises = PAISES;
  readonly paisesComunidad = PAISES_CACE;
  readonly programas = PROGRAMAS_EDUCATIVOS;
  readonly periodos = PERIODOS_ESCOLARES;
  prefijoTelefono = signal('');

  // --- Modal institución ---
  showInstitucionModal = false;
  institucionLoading = signal(false);
  institucionError = signal<string | null>(null);

  institucionForm = this.fb.group({
    nombre: ['', Validators.required],
    paisCodigo: ['', Validators.required],
    estado: ['', Validators.required],
    ciudad: ['', Validators.required],
    telefono: ['', Validators.required],
    correoInstitucional: ['', [Validators.required, Validators.email]],
  });

  // --- Modal materia ---
  showMateriaModal = false;
  editandoMateria: Materia | null = null;
  materiaLoading = signal(false);
  materiaError = signal<string | null>(null);

  materiaForm = this.fb.group({
    clave: ['', Validators.required],
    nombre: ['', Validators.required],
    programaEducativo: ['', Validators.required],
    descripcion: ['', Validators.required],
  });

  // --- Modal asignar ---
  showAsignarModal = false;
  materiaAsignar: Materia | null = null;
  asignarLoading = signal(false);
  asignarError = signal<string | null>(null);

  asignarForm = this.fb.group({
    docenteInstitucionId: this.fb.control<number | null>(
      null,
      Validators.required,
    ),
    periodoEscolar: this.fb.control<string>('', Validators.required),
  });

  // --- Solicitudes recibidas (Semana 4) ---
  solicitudesEntrantes = signal<SolicitudEntrante[]>([]);
  proyectos = signal<Proyecto[]>([]);

  // Secciones colapsables (materias empieza plegada).
  mostrarDocentes = signal(true);
  mostrarMaterias = signal(false);

  /** Avisos y confirmaciones con el mismo estilo que el resto de la aplicación. */
  avisoPanel = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  confirmacion = signal<{
    titulo: string;
    mensaje: string;
    accion: () => void;
  } | null>(null);

  showRevisionModal = false;
  solicitudARevisar: SolicitudEntrante | null = null;
  revisionLoading = signal(false);
  revisionError = signal<string | null>(null);

  revisionForm = this.fb.group({
    decision: ['APROBADA', Validators.required],
    comentario: [''],
    asignacionDestinoId: this.fb.control<number | null>(null),
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargarDocentes();
    this.cargarMaterias();
    this.cargarAsignaciones();
    this.cargarSolicitudes();
    this.cargarProyectos();
    this.cargarInstitucion();
  }

  /**
   * Recargas por recurso: antes, cada acción puntual recargaba las seis fuentes,
   * lo que hacía parpadear los contadores y podía pisar el formulario de
   * institución mientras se escribía.
   */
  cargarDocentes(): void {
    this.materiasService.listarDocentes().subscribe({
      next: (r) => this.docentes.set(r),
      error: (err: HttpErrorResponse) => {
        this.docentes.set([]);
        this.avisarErrorCarga(err);
      },
    });
  }

  cargarMaterias(): void {
    this.materiasService.listarMaterias().subscribe({
      next: (r) => this.materias.set(r),
      error: (err: HttpErrorResponse) => {
        this.materias.set([]);
        this.avisarErrorCarga(err);
      },
    });
  }

  cargarAsignaciones(): void {
    this.materiasService.listarAsignaciones().subscribe({
      next: (r) => this.asignaciones.set(r),
      error: (err: HttpErrorResponse) => {
        this.asignaciones.set([]);
        this.avisarErrorCarga(err);
      },
    });
  }

  cargarSolicitudes(): void {
    this.solicitudesService.listarEntrantes().subscribe({
      next: (r) => this.solicitudesEntrantes.set(r),
      error: (err: HttpErrorResponse) => {
        this.solicitudesEntrantes.set([]);
        this.avisarErrorCarga(err);
      },
    });
  }

  cargarProyectos(): void {
    this.proyectosService.listarInstitucion().subscribe({
      next: (r) => this.proyectos.set(r),
      error: (err: HttpErrorResponse) => {
        this.proyectos.set([]);
        this.avisarErrorCarga(err);
      },
    });
  }

  cargarInstitucion(): void {
    this.institucionesService.obtenerMia().subscribe({
      next: (r) => {
        this.institucion.set(r);
        this.institucionCargada.set(true);
        if (!r.registroCompleto) {
          this.institucionForm.patchValue({
            nombre: r.nombre,
            paisCodigo: r.codigoPais,
            estado: r.estado,
            ciudad: r.ciudad,
            telefono: r.telefono,
            correoInstitucional: r.correoInstitucional,
          });
          this.prefijoTelefono.set(this.prefijoDe(r.codigoPais));
        }
      },
      error: (err: HttpErrorResponse) => {
        this.institucion.set(null);
        this.institucionCargada.set(true);
        this.avisarErrorCarga(err);
      },
    });
  }

  private avisarErrorCarga(err: HttpErrorResponse): void {
    this.avisar(
      'error',
      `No se pudieron cargar los datos: ${extraerMensajeError(err, 'error de conexión')}`,
    );
  }

  reintentarCarga(): void {
    this.cerrarAviso();
    this.cargarDatos();
  }

  // --- Invitar docente ---
  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // --- Institución ---
  openEditarInstitucion(): void {
    const inst = this.institucion();
    this.institucionForm.patchValue({
      nombre: inst?.nombre ?? '',
      paisCodigo: inst?.codigoPais ?? '',
      estado: inst?.estado ?? '',
      ciudad: inst?.ciudad ?? '',
      telefono: inst?.telefono ?? '',
      correoInstitucional: inst?.correoInstitucional ?? '',
    });
    this.prefijoTelefono.set(this.prefijoDe(inst?.codigoPais ?? ''));
    this.institucionError.set(null);
    this.showInstitucionModal = true;
  }

  closeInstitucionModal(): void {
    this.showInstitucionModal = false;
  }

  submitInstitucion(): void {
    if (this.institucionLoading()) return;
    if (this.institucionForm.invalid) return;

    this.institucionLoading.set(true);
    this.institucionError.set(null);

    const v = this.institucionForm.value;
    const pais = PAISES.find((p) => p.codigo === (v.paisCodigo ?? ''));

    this.institucionesService
      .actualizarMia({
        nombre: v.nombre ?? '',
        pais: pais?.nombre ?? '',
        codigoPais: v.paisCodigo ?? '',
        estado: v.estado ?? '',
        ciudad: v.ciudad ?? '',
        telefono: `${this.prefijoTelefono()} ${v.telefono ?? ''}`.trim(),
        correoInstitucional: v.correoInstitucional ?? '',
      })
      .subscribe({
        next: (r) => {
          this.institucionLoading.set(false);
          this.showInstitucionModal = false;
          this.institucion.set(r);
        },
        error: (err: HttpErrorResponse) => {
          this.institucionLoading.set(false);
          this.institucionError.set(
            extraerMensajeError(err, 'Error al guardar la institución'),
          );
        },
      });
  }

  institucionCompleta(): boolean {
    return this.institucion()?.registroCompleto === true;
  }

  paisUsuario(): { codigo: string; nombre: string } | null {
    const codigo = this.institucion()?.codigoPais;
    if (!codigo) return null;
    const pais = PAISES.find((p) => p.codigo === codigo);
    return pais ? { codigo: pais.codigo, nombre: pais.nombre } : null;
  }

  flagUrl(codigo: string): string {
    return `https://flagcdn.com/w40/${codigo.toLowerCase()}.png`;
  }

  // --- Doble revisión ---

  /** La institución del agente frente a la solicitud. */
  esInstitucionOrigen(s: SolicitudEntrante): boolean {
    return (
      s.asignacionOrigen.docenteInstitucion.institucion.id ===
      this.institucion()?.id
    );
  }

  esInstitucionDestino(s: SolicitudEntrante): boolean {
    return s.institucionDestino.id === this.institucion()?.id;
  }

  /**
   * Etapa que le toca al agente: origen (1.ª) si la solicitud está pendiente,
   * destino (2.ª) si el origen ya la aprobó.
   */
  etapaRevision(s: SolicitudEntrante): 'ORIGEN' | 'DESTINO' | null {
    if (this.esInstitucionOrigen(s) && s.estado === 'PENDIENTE') {
      return 'ORIGEN';
    }
    if (this.esInstitucionDestino(s) && s.estado === 'APROBADA_POR_ORIGEN') {
      return 'DESTINO';
    }
    return null;
  }

  puedeRevisar(s: SolicitudEntrante): boolean {
    return this.etapaRevision(s) !== null;
  }

  etapaSolicitudARevisar(): 'ORIGEN' | 'DESTINO' | null {
    return this.solicitudARevisar
      ? this.etapaRevision(this.solicitudARevisar)
      : null;
  }

  pendientesEntrantes(): number {
    return this.solicitudesEntrantes().filter((s) => this.puedeRevisar(s))
      .length;
  }

  // --- Agrupación de solicitudes y proyectos por estado ---
  solicitudesPendientes(): SolicitudEntrante[] {
    return this.solicitudesEntrantes().filter((s) =>
      ['PENDIENTE', 'APROBADA_POR_ORIGEN'].includes(s.estado),
    );
  }

  solicitudesAceptadas(): SolicitudEntrante[] {
    return this.solicitudesEntrantes().filter((s) => s.estado === 'APROBADA');
  }

  solicitudesRechazadas(): SolicitudEntrante[] {
    return this.solicitudesEntrantes().filter((s) => s.estado === 'RECHAZADA');
  }

  proyectosActivos(): Proyecto[] {
    return this.proyectos().filter((p) =>
      ['EN_PLANIFICACION', 'EN_CURSO'].includes(p.estado),
    );
  }

  proyectosFinalizados(): Proyecto[] {
    return this.proyectos().filter((p) => p.estado === 'FINALIZADO');
  }

  proyectosCancelados(): Proyecto[] {
    return this.proyectos().filter((p) => p.estado === 'CANCELADO');
  }

  onPaisChange(): void {
    const codigo = this.institucionForm.get('paisCodigo')?.value;
    this.prefijoTelefono.set(this.prefijoDe(codigo ?? ''));
  }

  prefijoDe(codigo: string): string {
    return PAISES.find((p) => p.codigo === codigo)?.prefijo ?? '';
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

  openInvite(): void {
    this.showInviteModal = true;
    this.inviteError.set(null);
    this.inviteSuccess.set(null);
    this.inviteForm.reset();
  }

  closeInvite(): void {
    this.showInviteModal = false;
  }

  submitInvite(): void {
    if (this.inviteLoading()) return;
    if (this.inviteForm.invalid) return;

    this.inviteLoading.set(true);
    this.inviteError.set(null);
    this.inviteSuccess.set(null);

    this.agentes
      .invitarDocente(this.inviteForm.value as InviteDocenteDto)
      .subscribe({
        next: (res) => {
          this.inviteLoading.set(false);
          this.inviteForm.reset();
          this.showInviteModal = false;
          this.cargarDocentes();
          this.avisar('ok', `Invitación enviada a ${res.correo}`);
        },
        error: (err: HttpErrorResponse) => {
          this.inviteLoading.set(false);
          this.inviteError.set(
            extraerMensajeError(err, 'Error al invitar docente'),
          );
        },
      });
  }

  // --- Estado y eliminación de docentes ---
  cambiarEstadoDocente(d: DocenteInstitucion): void {
    this.materiasService.cambiarEstadoDocente(d.id, !d.activo).subscribe({
      next: () => this.cargarDocentes(),
      error: (err: HttpErrorResponse) =>
        this.avisar(
          'error',
          extraerMensajeError(err, 'Error al cambiar el estado del docente'),
        ),
    });
  }

  eliminarDocente(d: DocenteInstitucion): void {
    this.confirmarAccion(
      'Eliminar docente',
      `¿Eliminar al docente "${this.nombreDocente(d)}"?`,
      () =>
        this.materiasService.eliminarDocente(d.id).subscribe({
          next: () => this.cargarDocentes(),
          error: (err: HttpErrorResponse) =>
            this.avisar(
              'error',
              extraerMensajeError(err, 'Error al eliminar el docente'),
            ),
        }),
    );
  }

  // --- Materias ---
  openNuevaMateria(): void {
    this.editandoMateria = null;
    this.materiaForm.reset();
    this.materiaError.set(null);
    this.showMateriaModal = true;
  }

  openEditarMateria(m: Materia): void {
    this.editandoMateria = m;
    this.materiaForm.patchValue({
      clave: m.clave,
      nombre: m.nombre,
      programaEducativo: m.programaEducativo,
      descripcion: m.descripcion,
    });
    this.materiaError.set(null);
    this.showMateriaModal = true;
  }

  closeMateriaModal(): void {
    this.showMateriaModal = false;
  }

  submitMateria(): void {
    if (this.materiaLoading()) return;
    if (this.materiaForm.invalid) return;

    this.materiaLoading.set(true);
    this.materiaError.set(null);

    const data = this.materiaForm.value as {
      clave: string;
      nombre: string;
      programaEducativo: string;
      descripcion: string;
    };

    const req = this.editandoMateria
      ? this.materiasService.actualizarMateria(this.editandoMateria.id, data)
      : this.materiasService.crearMateria(data);

    req.subscribe({
      next: () => {
        this.materiaLoading.set(false);
        this.showMateriaModal = false;
        this.materiaForm.reset();
        this.cargarMaterias();
      },
      error: (err: HttpErrorResponse) => {
        this.materiaLoading.set(false);
        this.materiaError.set(
          extraerMensajeError(err, 'Error al guardar la materia'),
        );
      },
    });
  }

  eliminarMateria(m: Materia): void {
    this.confirmarAccion(
      'Eliminar materia',
      `¿Eliminar la materia "${m.nombre}"?`,
      () =>
        this.materiasService.eliminarMateria(m.id).subscribe({
          next: () => this.cargarMaterias(),
          error: (err: HttpErrorResponse) =>
            this.avisar(
              'error',
              extraerMensajeError(err, 'Error al eliminar la materia'),
            ),
        }),
    );
  }

  // --- Asignar docente ---
  openAsignar(m: Materia): void {
    this.materiaAsignar = m;
    this.asignarForm.reset({ docenteInstitucionId: null, periodoEscolar: '' });
    this.asignarError.set(null);
    this.showAsignarModal = true;
  }

  closeAsignarModal(): void {
    this.showAsignarModal = false;
  }

  submitAsignar(): void {
    if (this.asignarLoading()) return;
    if (this.asignarForm.invalid || !this.materiaAsignar) return;

    this.asignarLoading.set(true);
    this.asignarError.set(null);

    const { docenteInstitucionId, periodoEscolar } = this.asignarForm.value;
    if (docenteInstitucionId == null || !periodoEscolar) return;

    this.materiasService
      .asignarDocente({
        docenteInstitucionId,
        materiaId: this.materiaAsignar.id,
        periodoEscolar,
      })
      .subscribe({
        next: () => {
          this.asignarLoading.set(false);
          this.showAsignarModal = false;
          this.cargarAsignaciones();
        },
        error: (err: HttpErrorResponse) => {
          this.asignarLoading.set(false);
          this.asignarError.set(
            extraerMensajeError(err, 'Error al asignar docente'),
          );
        },
      });
  }

  quitarAsignacion(a: Asignacion): void {
    this.confirmarAccion('Quitar asignación', '¿Quitar esta asignación?', () =>
      this.materiasService.quitarAsignacion(a.id).subscribe({
        next: () => this.cargarAsignaciones(),
        error: (err: HttpErrorResponse) =>
          this.avisar(
            'error',
            extraerMensajeError(err, 'Error al quitar la asignación'),
          ),
      }),
    );
  }

  // --- Revisión de solicitudes (Semana 4) ---
  openRevision(s: SolicitudEntrante): void {
    this.solicitudARevisar = s;
    this.revisionForm.reset({
      decision: 'APROBADA',
      comentario: '',
      asignacionDestinoId: null,
    });
    this.revisionError.set(null);
    this.showRevisionModal = true;
  }

  closeRevision(): void {
    this.showRevisionModal = false;
  }

  submitRevision(): void {
    if (this.revisionLoading() || !this.solicitudARevisar) return;

    const { decision, comentario, asignacionDestinoId } =
      this.revisionForm.value;

    // El docente de destino solo se elige en la 2.ª revisión al aprobar.
    const esDestino = this.etapaRevision(this.solicitudARevisar) === 'DESTINO';
    const aprueba = decision === 'APROBADA';

    if (esDestino && aprueba && asignacionDestinoId == null) {
      this.revisionError.set(
        'Selecciona el docente que impartirá la clase espejo',
      );
      return;
    }

    // El backend lo exige: se avisa aquí para no gastar un viaje al servidor.
    if (decision === 'RECHAZADA' && !(comentario ?? '').trim()) {
      this.revisionError.set(
        'Indica el motivo del rechazo en el comentario',
      );
      return;
    }

    this.revisionLoading.set(true);
    this.revisionError.set(null);

    this.solicitudesService
      .revisar(this.solicitudARevisar.id, {
        decision: decision ?? 'APROBADA',
        comentario: comentario ?? '',
        ...(esDestino && aprueba
          ? { asignacionDestinoId: asignacionDestinoId! }
          : {}),
      } as RevisarSolicitudDto)
      .subscribe({
        next: () => {
          this.revisionLoading.set(false);
          this.showRevisionModal = false;
          this.cargarSolicitudes();
          this.cargarProyectos();
        },
        error: (err: HttpErrorResponse) => {
          this.revisionLoading.set(false);
          this.revisionError.set(
            extraerMensajeError(err, 'Error al revisar la solicitud'),
          );
        },
      });
  }

  // --- Helpers ---
  nombreDocente(di: DocenteInstitucion): string {
    const u = di.docente?.usuario;
    return u ? `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}` : 'Docente';
  }

  asignacionesDeMateria(materiaId: number): Asignacion[] {
    return this.asignaciones().filter((a) => a.materia.id === materiaId);
  }

  nombreDocenteEntrante(s: SolicitudEntrante): string {
    const u = s.asignacionOrigen?.docenteInstitucion?.docente?.usuario;
    return u
      ? `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`
      : 'Docente';
  }

  estadoLabelSolicitud(s: SolicitudEntrante): string {
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
