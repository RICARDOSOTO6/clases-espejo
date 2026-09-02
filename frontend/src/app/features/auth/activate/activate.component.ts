import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { extraerMensajeError } from '../../../core/utils/http-error.util';

@Component({
  selector: 'app-activate',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './activate.component.html',
})
export class ActivateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  token: string | null = null;
  correo = signal<string | null>(null);

  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmar: ['', Validators.required],
  });

  error = signal<string | null>(null);
  loading = signal(false);
  showPassword = false;
  success = signal(false);
  tokenInvalido = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.tokenInvalido.set(true);
      return;
    }

    this.auth.validarTokenInvitacion(this.token).subscribe({
      next: (res) => {
        this.correo.set(res.correo);
      },
      error: (err: HttpErrorResponse) => {
        this.tokenInvalido.set(true);
        this.error.set(
          extraerMensajeError(err, 'El enlace no es válido o ha expirado.'),
        );
      },
    });
  }

  mensajeDe(campo: 'password' | 'confirmar'): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['minlength']) return 'Mínimo 6 caracteres';
    return null;
  }

  get passwordsNoCoinciden(): boolean {
    const { password, confirmar } = this.form.value;
    return !!password && !!confirmar && password !== confirmar;
  }

  submit(): void {
    if (this.loading()) return;

    if (this.form.invalid || this.passwordsNoCoinciden || !this.token) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.activarCuenta(this.token, this.form.value.password!).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(extraerMensajeError(err, 'Error al activar la cuenta'));
      },
    });
  }
}
