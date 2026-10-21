import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { IdentidadCaceService } from '../../../core/services/identidad-cace.service';
import { extraerMensajeError } from '../../../core/utils/http-error.util';
import { mensajeDeControl } from '../../../core/utils/formulario.util';

/**
 * Pantalla «¿Olvidaste tu contraseña?».
 *
 * Pide el correo y el servidor responde **siempre lo mismo**, exista o no la
 * cuenta: así no se puede usar este formulario para averiguar qué correos están
 * registrados. El enlace llega al correo y caduca en una hora.
 */
@Component({
  selector: 'app-recuperar',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './recuperar.component.html',
})
export class RecuperarComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly identidad = inject(IdentidadCaceService);

  readonly logo = this.identidad.logo;
  readonly lema = this.identidad.lema;
  readonly descripcion = this.identidad.descripcion;

  form = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
  });

  enviado = signal(false);
  mensaje = signal('');
  error = signal<string | null>(null);
  loading = signal(false);

  mensajeDe(): string | null {
    return mensajeDeControl(this.form, 'correo', {
      required: 'Este campo es obligatorio',
      email: 'Introduce un correo válido',
    });
  }

  submit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.recuperarPassword(this.form.value.correo!).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.enviado.set(true);
        this.mensaje.set(res.mensaje);
        this.form.reset();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudo enviar el correo de recuperación'),
        );
      },
    });
  }
}
