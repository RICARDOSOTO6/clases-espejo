import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterDto } from '../../../core/models/auth.models';
import { extraerMensajeError } from '../../../core/utils/http-error.util';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  form = this.fb.group({
    nombres: ['', Validators.required],
    apellidoPaterno: ['', Validators.required],
    apellidoMaterno: ['', Validators.required],
    dni: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    nombreInstitucion: ['', Validators.required],
    pais: ['', Validators.required],
    correoInstitucional: ['', [Validators.required, Validators.email]],
    cargo: ['', Validators.required],
  });

  error = signal<string | null>(null);
  loading = signal(false);
  showPassword = false;

  readonly cargos = [
    'Coordinador(a) de Internacionalización',
    'Jefe(a) de Internacionalización',
    'Director(a) de Relaciones Internacionales',
    'Asistente de Internacionalización',
    'Responsable de Movilidad Académica',
    'Otro',
  ];

  readonly institucionesSugeridas = [
    'Universidad Nacional Autónoma de México',
    'Instituto Tecnológico Superior de Calkiní',
    'Tecnológico Nacional de México',
    'Universidad de Guadalajara',
    'Universidad Autónoma de Nuevo León',
    'Universidad de Buenos Aires',
    'Universidad Nacional de Colombia',
    'Universidad de Chile',
    'Pontificia Universidad Católica del Perú',
    'Universidad Central del Ecuador',
    'Universidad de Costa Rica',
    'Universidad Nacional Autónoma de Honduras',
  ];

  mensajeDe(campo: string): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['email']) return 'Introduce un correo válido';
    if (control.errors['minlength']) return 'Mínimo 6 caracteres';
    return null;
  }

  submit(): void {
    if (this.loading()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.register(this.form.value as RegisterDto).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/login'], { queryParams: { registrado: '1' } });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(extraerMensajeError(err, 'Error al registrarse'));
      },
    });
  }
}
