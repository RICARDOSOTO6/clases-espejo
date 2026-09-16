import { Component, inject, OnInit, signal } from '@angular/core';
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

@Component({
  selector: 'app-docente',
  imports: [ReactiveFormsModule, ModalComponent, RouterLink],
  templateUrl: './docente.component.html',
})
export class DocenteComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly solicitudesService = inject(SolicitudesService);
  private readonly institucionesService = inject(InstitucionesService);
  private readonly proyectosService = inject(ProyectosService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  usuario = this.auth.currentUser();
  readonly paisesComunidad = PAISES_CACE;

  asignaciones = signal<AsignacionMia[]>([]);
  instituciones = signal<Institucion[]>([]);
  materiasDestino = signal<Materia[]>([]);
  solicitudes = signal<Solicitud[]>([]);
  proyectos = signal<Proyecto[]>([]);
  paisUsuario = signal<{ codigo: string; nombre: string } | null>(null);

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
      next: (r) => this.solicitudes.set(r),
      error: () => this.solicitudes.set([]),
    });
    this.proyectosService.listarMios().subscribe({
      next: (r) => this.proyectos.set(r),
      error: () => this.proyectos.set([]),
    });
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
    const destinoId = this.solicitudForm.get('institucionDestinoId')?.value;
    this.materiasDestino.set([]);
    this.solicitudForm.patchValue({ materiaDestinoId: null });
    if (destinoId != null) {
      this.institucionesService.listarMaterias(destinoId).subscribe({
        next: (r) => this.materiasDestino.set(r),
        error: () => this.materiasDestino.set([]),
      });
    }
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
    this.onDestinoChange();
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
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
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
