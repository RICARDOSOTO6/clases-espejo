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
import {
  CARGOS,
  PAISES,
  TIPOS_DOCUMENTO,
} from '../../../core/constants/catalogos';
import { esTextoValido } from '../../../core/utils/validators';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly paises = PAISES;
  readonly tiposDocumento = TIPOS_DOCUMENTO;
  readonly cargos = CARGOS;

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

  form = this.fb.group({
    nombres: ['', [Validators.required, esTextoValido()]],
    apellidoPaterno: ['', [Validators.required, esTextoValido()]],
    apellidoMaterno: ['', [Validators.required, esTextoValido()]],
    tipoDocumento: ['DNI', Validators.required],
    dni: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    nombreInstitucion: ['', [Validators.required, esTextoValido()]],
    paisCodigo: ['', Validators.required],
    estado: ['', [Validators.required, esTextoValido()]],
    ciudad: ['', [Validators.required, esTextoValido()]],
    telefono: ['', Validators.required],
    correoInstitucional: ['', [Validators.required, Validators.email]],
    cargo: ['', Validators.required],
  });

  error = signal<string | null>(null);
  loading = signal(false);
  showPassword = false;
  prefijoTelefono = signal('');

  onPaisChange(): void {
    const codigo = this.form.get('paisCodigo')?.value;
    const pais = PAISES.find((p) => p.codigo === codigo);
    this.prefijoTelefono.set(pais?.prefijo ?? '');
  }

  mensajeDe(campo: string): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['email']) return 'Introduce un correo válido';
    if (control.errors['minlength']) return 'Mínimo 6 caracteres';
    if (control.errors['textoInvalido'])
      return 'Escribe un valor válido (solo letras, sin secuencias aleatorias)';
    return null;
  }

  submit(): void {
    if (this.loading()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const pais = PAISES.find((p) => p.codigo === v.paisCodigo);

    const dto: RegisterDto = {
      nombres: v.nombres ?? '',
      apellidoPaterno: v.apellidoPaterno ?? '',
      apellidoMaterno: v.apellidoMaterno ?? '',
      tipoDocumento: v.tipoDocumento ?? 'DNI',
      dni: v.dni ?? '',
      correo: v.correo ?? '',
      password: v.password ?? '',
      nombreInstitucion: v.nombreInstitucion ?? '',
      pais: pais?.nombre ?? '',
      codigoPais: v.paisCodigo ?? '',
      estado: v.estado ?? '',
      ciudad: v.ciudad ?? '',
      telefono: `${this.prefijoTelefono()} ${v.telefono ?? ''}`.trim(),
      correoInstitucional: v.correoInstitucional ?? '',
      cargo: v.cargo ?? '',
    };

    this.loading.set(true);
    this.error.set(null);

    this.auth.register(dto).subscribe({
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
