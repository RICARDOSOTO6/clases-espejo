import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretariasService } from '../../../core/services/secretarias.service';
import { extraerMensajeError } from '../../../core/utils/http-error.util';

/**
 * Cuestionario público de una invitación de secretaría. El token se consume una
 * sola vez y el correo se pide aquí, aunque la invitación se haya creado sin
 * correo.
 */
@Component({
  selector: 'app-activar-secretaria',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './activar-secretaria.component.html',
})
export class ActivarSecretariaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly secretarias = inject(SecretariasService);
  private readonly route = inject(ActivatedRoute);

  readonly tiposDocumento = ['DNI', 'Pasaporte', 'Cédula'];
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly valido = signal(false);
  readonly completado = signal(false);
  readonly error = signal<string | null>(null);
  readonly institucion = signal<string | null>(null);
  token = '';

  readonly form = this.fb.group({
    nombres: ['', [Validators.required]],
    apellidoPaterno: ['', [Validators.required]],
    apellidoMaterno: ['', [Validators.required]],
    tipoDocumento: ['DNI', [Validators.required]],
    dni: ['', [Validators.required]],
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
    confirmar: ['', [Validators.required]],
    aceptaAviso: [false, [Validators.requiredTrue]],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.cargando.set(false);
      this.error.set('El enlace no tiene un token de invitación.');
      return;
    }
    this.secretarias.validarInvitacion(this.token).subscribe({
      next: (respuesta) => {
        this.cargando.set(false);
        this.valido.set(true);
        this.institucion.set(respuesta.institucion.nombre);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(extraerMensajeError(err, 'La invitación no es válida o ya expiró.'));
      },
    });
  }

  get passwordsNoCoinciden(): boolean {
    const { password, confirmar } = this.form.value;
    return !!password && !!confirmar && password !== confirmar;
  }

  submit(): void {
    if (this.guardando() || !this.valido()) return;
    if (this.form.invalid || this.passwordsNoCoinciden) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();
    this.secretarias
      .activar({
        token: this.token,
        nombres: v.nombres ?? '',
        apellidoPaterno: v.apellidoPaterno ?? '',
        apellidoMaterno: v.apellidoMaterno ?? '',
        tipoDocumento: v.tipoDocumento ?? 'DNI',
        dni: v.dni ?? '',
        correo: v.correo ?? '',
        password: v.password ?? '',
        aceptaAviso: v.aceptaAviso === true,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.completado.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(extraerMensajeError(err, 'No se pudo activar la secretaría.'));
        },
      });
  }

  mensaje(campo: string): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || control.valid) return null;
    if (control.hasError('required')) return 'Este campo es obligatorio';
    if (control.hasError('email')) return 'Escribe un correo válido';
    if (control.hasError('minlength')) return 'Mínimo 12 caracteres';
    return null;
  }
}
