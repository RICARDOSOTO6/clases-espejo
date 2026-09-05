import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
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
import { Institucion, InviteDocenteDto } from '../../core/models/auth.models';
import {
  Asignacion,
  DocenteInstitucion,
  Materia,
} from '../../core/models/materia.models';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-agente',
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './agente.component.html',
})
export class AgenteComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly agentes = inject(AgentesService);
  private readonly materiasService = inject(MateriasService);
  private readonly institucionesService = inject(InstitucionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  usuario = this.auth.currentUser();

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

  // --- Modal institución ---
  showInstitucionModal = false;
  institucionLoading = signal(false);
  institucionError = signal<string | null>(null);

  institucionForm = this.fb.group({
    nombre: ['', Validators.required],
    pais: ['', Validators.required],
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

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.materiasService.listarDocentes().subscribe({
      next: (r) => this.docentes.set(r),
      error: () => this.docentes.set([]),
    });
    this.materiasService.listarMaterias().subscribe({
      next: (r) => this.materias.set(r),
      error: () => this.materias.set([]),
    });
    this.materiasService.listarAsignaciones().subscribe({
      next: (r) => this.asignaciones.set(r),
      error: () => this.asignaciones.set([]),
    });
    this.institucionesService.obtenerMia().subscribe({
      next: (r) => this.institucion.set(r),
      error: () => this.institucion.set(null),
    });
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
      pais: inst?.pais ?? '',
      correoInstitucional: inst?.correoInstitucional ?? '',
    });
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

    this.institucionesService
      .actualizarMia(
        this.institucionForm.value as {
          nombre: string;
          pais: string;
          correoInstitucional: string;
        },
      )
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
          this.cargarDatos();
          window.alert(`Invitación enviada a ${res.correo}`);
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
      next: () => this.cargarDatos(),
      error: (err: HttpErrorResponse) =>
        window.alert(
          extraerMensajeError(err, 'Error al cambiar el estado del docente'),
        ),
    });
  }

  eliminarDocente(d: DocenteInstitucion): void {
    if (!window.confirm(`¿Eliminar al docente "${this.nombreDocente(d)}"?`)) {
      return;
    }
    this.materiasService.eliminarDocente(d.id).subscribe({
      next: () => this.cargarDatos(),
      error: (err: HttpErrorResponse) =>
        window.alert(extraerMensajeError(err, 'Error al eliminar el docente')),
    });
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
        this.cargarDatos();
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
    if (!window.confirm(`¿Eliminar la materia "${m.nombre}"?`)) return;
    this.materiasService.eliminarMateria(m.id).subscribe({
      next: () => this.cargarDatos(),
      error: (err: HttpErrorResponse) =>
        window.alert(extraerMensajeError(err, 'Error al eliminar la materia')),
    });
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
          this.cargarDatos();
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
    if (!window.confirm('¿Quitar esta asignación?')) return;
    this.materiasService.quitarAsignacion(a.id).subscribe({
      next: () => this.cargarDatos(),
      error: (err: HttpErrorResponse) =>
        window.alert(extraerMensajeError(err, 'Error al quitar la asignación')),
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
}
