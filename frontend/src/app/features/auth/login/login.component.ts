import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { extraerMensajeError } from '../../../core/utils/http-error.util';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  form = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  error = signal<string | null>(null);
  loading = signal(false);
  showPassword = false;
  success = false;
  showRecoveryHint = false;

  ngOnInit(): void {
    this.success = this.route.snapshot.queryParamMap.has('registrado');

    const user = this.auth.currentUser();
    if (this.auth.isAuthenticated && user) {
      this.router.navigate([this.destinoPorRol(user.rol)]);
    }
  }

  mensajeDe(campo: 'correo' | 'password'): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['email']) return 'Introduce un correo válido';
    if (control.errors['minlength']) return 'Mínimo 6 caracteres';
    return null;
  }

  toggleRecoveryHint(): void {
    this.showRecoveryHint = !this.showRecoveryHint;
  }

  submit(): void {
    if (this.loading()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { correo, password } = this.form.value;

    this.auth.login(correo!, password!).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.form.reset();
        this.router.navigate([this.destinoPorRol(res.usuario.rol)]);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(extraerMensajeError(err, 'Error al iniciar sesión'));
        this.form.reset();
      },
    });
  }

  private destinoPorRol(rol: string | null): string {
    return rol === 'DOCENTE' ? '/docente' : '/agente';
  }
}
