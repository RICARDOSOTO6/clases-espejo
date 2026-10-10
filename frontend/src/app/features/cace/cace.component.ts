import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CaceService, DecisionCace, InstitucionCace } from '../../core/services/cace.service';
import { PendienteUi, UiStateService } from '../../core/services/ui-state.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { fechaHoraLarga } from '../../core/utils/fecha.util';
import { urlDeArchivo } from '../../core/utils/url-archivo.util';

/** Decisión que exige motivo: el correo al agente lo lleva escrito. */
type DecisionConMotivo = 'rechazar' | 'vetar';

/**
 * Primera pantalla del presidente de la CACE.
 *
 * Va **sin** el esqueleto `<app-layout>`: ese esqueleto es el de agentes y
 * docentes (menús, contadores y campana de sus pendientes) y la CACE todavía no
 * tiene nada de eso. Aquí está el cambio de contraseña obligatorio del primer
 * acceso y la gestión de instituciones (aprobar, rechazar, vetar y reactivar).
 */
@Component({
  selector: 'app-cace',
  imports: [ReactiveFormsModule],
  templateUrl: './cace.component.html',
  styleUrl: './cace.component.css',
})
export class CaceComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly cace = inject(CaceService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  /** Estado compartido con el esqueleto (la campana de pendientes). */
  private readonly ui = inject(UiStateService);

  /** La sesión es la fuente de verdad: al cambiarla, esto se actualiza solo. */
  readonly usuario = this.auth.currentUser;
  readonly debeCambiarPassword = computed(
    () => this.auth.currentUser()?.debeCambiarPassword === true,
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);

  // --- Instituciones ---
  readonly instituciones = signal<InstitucionCace[]>([]);
  readonly cargando = signal(false);
  readonly errorInstituciones = signal<string | null>(null);
  readonly avisoInstituciones = signal<string | null>(null);
  /** Institución cuya decisión está en curso (evita el doble clic). */
  readonly enProceso = signal<number | null>(null);
  /** Institución a la que se le está pidiendo el motivo, y para qué. */
  readonly pidiendoMotivo = signal<{
    id: number;
    nombre: string;
    decision: DecisionConMotivo;
  } | null>(null);
  /** Institución rechazada cuyo borrado definitivo se está confirmando. */
  readonly pidiendoBorrado = signal<InstitucionCace | null>(null);

  readonly pendientes = computed(() =>
    this.instituciones().filter((i) => i.estadoCace === 'PENDIENTE'),
  );

  form = this.fb.group({
    actual: ['', Validators.required],
    nueva: ['', [Validators.required, Validators.minLength(8)]],
    confirmar: ['', Validators.required],
  });

  /** Motivo del rechazo o del veto que se está escribiendo. */
  readonly motivo = this.fb.control('', Validators.required);

  ngOnInit(): void {
    // Mientras no cambie la contraseña provisional, el panel no se usa.
    if (!this.debeCambiarPassword()) {
      this.cargarInstituciones();
    }
  }

  ngOnDestroy(): void {
    // Al salir no se dejan pendientes de otra pantalla en la campana.
    this.ui.limpiarPantalla();
  }

  get nombreUsuario(): string {
    const u = this.usuario();
    return u
      ? `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`.trim()
      : '';
  }

  mensajeDe(campo: 'actual' | 'nueva' | 'confirmar'): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['minlength']) return 'Mínimo 8 caracteres';
    return null;
  }

  submit(): void {
    if (this.loading()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { actual, nueva, confirmar } = this.form.value;

    // Se comprueba aquí lo que el servidor no puede saber: que la
    // confirmación coincida. El mínimo de 8 ya lo valida el propio formulario.
    if (nueva !== confirmar) {
      this.error.set('La confirmación no coincide con la nueva contraseña');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.exito.set(null);

    this.auth.cambiarPassword(actual!, nueva!).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.exito.set(res.mensaje);
        this.form.reset();
        // Ya se puede usar el panel: se carga la sección de instituciones.
        this.cargarInstituciones();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudo cambiar la contraseña'),
        );
      },
    });
  }

  // --- Instituciones: datos ---

  cargarInstituciones(): void {
    this.cargando.set(true);
    this.errorInstituciones.set(null);
    this.cace.listarInstituciones().subscribe({
      next: (lista) => {
        this.instituciones.set(lista);
        this.cargando.set(false);
        this.publicarEnCampana();
      },
      error: (err: HttpErrorResponse) => {
        this.instituciones.set([]);
        this.cargando.set(false);
        this.errorInstituciones.set(
          extraerMensajeError(err, 'No se pudieron cargar las instituciones'),
        );
        this.publicarEnCampana();
      },
    });
  }

  // --- Instituciones: decisiones ---

  aprobar(institucion: InstitucionCace): void {
    this.ejecutar(this.cace.aprobar(institucion.id), institucion.id);
  }

  reactivar(institucion: InstitucionCace): void {
    this.ejecutar(this.cace.reactivar(institucion.id), institucion.id);
  }

  /** Rechazar y vetar exigen motivo: se pide antes de enviar nada. */
  pedirMotivo(institucion: InstitucionCace, decision: DecisionConMotivo): void {
    this.motivo.reset('');
    this.avisoInstituciones.set(null);
    this.errorInstituciones.set(null);
    this.pidiendoMotivo.set({
      id: institucion.id,
      nombre: institucion.nombre,
      decision,
    });
  }

  cancelarMotivo(): void {
    this.pidiendoMotivo.set(null);
    this.motivo.reset('');
  }

  confirmarMotivo(): void {
    const pendiente = this.pidiendoMotivo();
    if (!pendiente) return;

    const motivo = (this.motivo.value ?? '').trim();
    if (!motivo) {
      this.motivo.markAsTouched();
      return;
    }

    this.ejecutar(
      pendiente.decision === 'rechazar'
        ? this.cace.rechazar(pendiente.id, motivo)
        : this.cace.vetar(pendiente.id, motivo),
      pendiente.id,
    );
  }

  private ejecutar(peticion: Observable<DecisionCace>, id: number): void {
    if (this.enProceso() !== null) return;

    this.enProceso.set(id);
    this.avisoInstituciones.set(null);
    this.errorInstituciones.set(null);

    peticion.subscribe({
      next: (res) => {
        this.enProceso.set(null);
        this.pidiendoMotivo.set(null);
        this.motivo.reset('');
        this.avisoInstituciones.set(res.mensaje);
        // El estado y quién lo decidió los pone el servidor: se recarga la lista.
        this.cargarInstituciones();
      },
      error: (err: HttpErrorResponse) => {
        this.enProceso.set(null);
        this.errorInstituciones.set(extraerMensajeError(err, 'No se pudo completar la decisión'));
      },
    });
  }

  // --- Borrado definitivo (solo instituciones rechazadas y sin historia) ---

  /** El borrado es irreversible: se confirma antes de enviarlo. */
  pedirBorrado(institucion: InstitucionCace): void {
    this.avisoInstituciones.set(null);
    this.errorInstituciones.set(null);
    this.pidiendoBorrado.set(institucion);
  }

  cancelarBorrado(): void {
    this.pidiendoBorrado.set(null);
  }

  confirmarBorrado(): void {
    const institucion = this.pidiendoBorrado();
    if (!institucion || this.enProceso() !== null) return;

    this.enProceso.set(institucion.id);
    this.avisoInstituciones.set(null);
    this.errorInstituciones.set(null);

    this.cace.eliminarInstitucion(institucion.id).subscribe({
      next: (res) => {
        this.enProceso.set(null);
        this.pidiendoBorrado.set(null);
        this.avisoInstituciones.set(res.mensaje);
        this.cargarInstituciones();
      },
      error: (err: HttpErrorResponse) => {
        this.enProceso.set(null);
        this.pidiendoBorrado.set(null);
        // El servidor explica qué historia lo impide, o que no estaba rechazada.
        this.errorInstituciones.set(
          extraerMensajeError(err, 'No se pudo borrar la institución'),
        );
      },
    });
  }

  /** URL del logo lista para un `<img>`. */
  logoDe(institucion: InstitucionCace): string | null {
    return urlDeArchivo(institucion.logoUrl);
  }

  // --- Presentación ---

  etiquetaEstado(estadoCace: string): string {
    switch (estadoCace) {
      case 'PENDIENTE':
        return 'Pendiente';
      case 'APROBADA':
        return 'Aprobada';
      case 'RECHAZADA':
        return 'Rechazada';
      case 'VETADA':
        return 'Vetada';
      default:
        return estadoCace;
    }
  }

  claseEstado(estadoCace: string): string {
    switch (estadoCace) {
      case 'PENDIENTE':
        return 'estado pendiente';
      case 'APROBADA':
        return 'estado aprobada';
      case 'RECHAZADA':
        return 'estado rechazada';
      case 'VETADA':
        return 'estado vetada';
      default:
        return 'estado cancelada';
    }
  }

  fechaRevision(valor: string | null): string {
    return valor ? fechaHoraLarga(valor) : '';
  }

  /**
   * La campana avisa de lo que espera al presidente. Publicar aquí es lo que
   * hacen las pantallas de docente y agente con sus propios pendientes.
   */
  private publicarEnCampana(): void {
    const pendientes = this.pendientes().length;
    const avisos: PendienteUi[] = [];
    if (pendientes > 0) {
      avisos.push({
        titulo: `${pendientes} ${pendientes === 1 ? 'institución' : 'instituciones'} por aprobar`,
        detalle: 'Revísalas y decide si se aprueban, se rechazan o se vetan.',
        ancla: 'instituciones',
        tono: 'aviso',
      });
    }
    this.ui.publicarPendientes(avisos);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
