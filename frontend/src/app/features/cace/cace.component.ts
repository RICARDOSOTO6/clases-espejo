import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';

/**
 * Primera pantalla del presidente de la CACE.
 *
 * Va **sin** el esqueleto `<app-layout>`: ese esqueleto es el de agentes y
 * docentes (menús, contadores y campana de sus pendientes) y la CACE todavía no
 * tiene nada de eso. Aquí solo está el saludo y el cambio de contraseña
 * obligatorio del primer acceso.
 */
@Component({
  selector: 'app-cace',
  imports: [ReactiveFormsModule],
  templateUrl: './cace.component.html',
  styleUrl: './cace.component.css',
})
export class CaceComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  /** La sesión es la fuente de verdad: al cambiarla, esto se actualiza solo. */
  readonly usuario = this.auth.currentUser;
  readonly debeCambiarPassword = computed(
    () => this.auth.currentUser()?.debeCambiarPassword === true,
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);

  form = this.fb.group({
    actual: ['', Validators.required],
    nueva: ['', [Validators.required, Validators.minLength(8)]],
    confirmar: ['', Validators.required],
  });

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
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudo cambiar la contraseña'),
        );
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
