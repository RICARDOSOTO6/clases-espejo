import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { SolicitudesService } from '../../core/services/solicitudes.service';
import { InstitucionesService } from '../../core/services/instituciones.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { Institucion } from '../../core/models/auth.models';
import { Materia } from '../../core/models/materia.models';
import {
  AsignacionMia,
  CreateSolicitudDto,
  Solicitud,
} from '../../core/models/solicitud.models';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-docente',
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './docente.component.html',
})
export class DocenteComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly solicitudesService = inject(SolicitudesService);
  private readonly institucionesService = inject(InstitucionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  usuario = this.auth.currentUser();

  asignaciones = signal<AsignacionMia[]>([]);
  instituciones = signal<Institucion[]>([]);
  materiasDestino = signal<Materia[]>([]);
  solicitudes = signal<Solicitud[]>([]);

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
    this.solicitudesService.misAsignaciones().subscribe({
      next: (r) => this.asignaciones.set(r),
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
    if (!window.confirm(`¿Cancelar la solicitud "${s.titulo}"?`)) return;
    this.solicitudesService.cancelar(s.id).subscribe({
      next: () => this.cargarDatos(),
      error: (err: HttpErrorResponse) =>
        window.alert(extraerMensajeError(err, 'Error al cancelar la solicitud')),
    });
  }

  // --- Helpers ---
  nombreAsignacion(a: AsignacionMia): string {
    return `${a.materia.nombre} · ${a.periodoEscolar}`;
  }

  estadoLabel(s: Solicitud): string {
    switch (s.estado) {
      case 'PENDIENTE':
        return 'Pendiente';
      case 'APROBADA':
        return 'Aprobada';
      case 'RECHAZADA':
        return 'Rechazada';
      case 'CANCELADA':
        return 'Cancelada';
      default:
        return s.estado;
    }
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
}
