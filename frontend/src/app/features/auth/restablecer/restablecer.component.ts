import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { IdentidadCaceService } from '../../../core/services/identidad-cace.service';
import { extraerMensajeError } from '../../../core/utils/http-error.util';
import { mensajeDeControl } from '../../../core/utils/formulario.util';

/** Mínimo de la política de contraseñas: 12 caracteres. */
export const PASSWORD_MINIMO = 12;

/**
 * Pantalla a la que lleva el enlace del correo de recuperación (`/restablecer?token=…`).
 *
 * Antes de enseñar el formulario valida el token contra el servidor (así un
 * enlace caducado o ya usado se explica al momento). El token es de un solo
 * uso: al guardar la nueva contraseña, el servidor lo gasta y cierra las
 * sesiones abiertas.
 */
@Component({
  selector: 'app-restablecer',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './restablecer.component.html',
})
export class RestablecerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly identidad = inject(IdentidadCaceService);

  readonly logo = this.identidad.logo;
  readonly lema = this.identidad.lema;
  readonly descripcion = this.identidad.descripcion;
  readonly minimo = PASSWORD_MINIMO;

  private token = '';

  estado = signal<'validando' | 'listo' | 'invalido' | 'hecho'>('validando');
  correo = signal('');
  mensaje = signal('');
  error = signal<string | null>(null);
  loading = signal(false);

  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MINIMO)]],
    confirmar: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.estado.set('invalido');
      this.error.set(
        'Falta el código del enlace. Abre el enlace completo del correo de recuperación.',
      );
      return;
    }

    this.auth.validarRecuperacion(this.token).subscribe({
      next: (res) => {
        this.correo.set(res.correo);
        this.estado.set('listo');
      },
      error: (err: HttpErrorResponse) => {
        this.estado.set('invalido');
        this.error.set(
          extraerMensajeError(
            err,
            'El enlace no es válido o caducó. Pide otro correo de recuperación.',
          ),
        );
      },
    });
  }

  mensajeDe(campo: 'password' | 'confirmar'): string | null {
    if (campo === 'confirmar') {
      return mensajeDeControl(this.form, 'confirmar', {
        required: 'Repite la contraseña',
      });
    }
    return mensajeDeControl(this.form, 'password', {
      required: 'Este campo es obligatorio',
      minlength: `Mínimo ${PASSWORD_MINIMO} caracteres`,
    });
  }

  submit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const password = this.form.value.password ?? '';
    if (password !== (this.form.value.confirmar ?? '')) {
      this.error.set('La confirmación no coincide con la nueva contraseña');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.restablecerPassword(this.token, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.mensaje.set(res.mensaje);
        this.estado.set('hecho');
        this.form.reset();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudo restablecer la contraseña'),
        );
      },
    });
  }
}
