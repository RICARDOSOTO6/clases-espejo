import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { InvitacionesAgenteService } from '../../../core/services/invitaciones-agente.service';
import { extraerMensajeError } from '../../../core/utils/http-error.util';
import {
  CARGOS,
  PAISES,
  TIPOS_DOCUMENTO,
} from '../../../core/constants/catalogos';

/**
 * Cuestionario público de la invitación que crea la presidencia. La persona
 * crea su institución; la CACE la revisa después.
 */
@Component({
  selector: 'app-activar-agente',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './activar-agente.component.html',
})
export class ActivarAgenteComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly invitaciones = inject(InvitacionesAgenteService);
  private readonly route = inject(ActivatedRoute);

  readonly paises = PAISES;
  readonly tiposDocumento = TIPOS_DOCUMENTO;
  readonly cargos = CARGOS;
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly valido = signal(false);
  readonly completado = signal(false);
  readonly error = signal<string | null>(null);
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
    nombreInstitucion: ['', [Validators.required]],
    paisCodigo: ['', [Validators.required]],
    estado: ['', [Validators.required]],
    ciudad: ['', [Validators.required]],
    telefono: ['', [Validators.required]],
    correoInstitucional: ['', [Validators.required, Validators.email]],
    cargo: ['', [Validators.required]],
    aceptaAviso: [false, [Validators.requiredTrue]],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.cargando.set(false);
      this.error.set('El enlace no tiene un token de invitación.');
      return;
    }
    this.invitaciones.validar(this.token).subscribe({
      next: () => {
        this.cargando.set(false);
        this.valido.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(
          extraerMensajeError(err, 'La invitación no es válida o ya expiró.'),
        );
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
    const v = this.form.getRawValue();
    const pais = this.paises.find((p) => p.codigo === v.paisCodigo);
    if (!pais) {
      this.error.set('Selecciona un país válido.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.invitaciones
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
        nombreInstitucion: v.nombreInstitucion ?? '',
        pais: pais.nombre,
        codigoPais: pais.codigo,
        estado: v.estado ?? '',
        ciudad: v.ciudad ?? '',
        telefono: v.telefono ?? '',
        correoInstitucional: v.correoInstitucional ?? '',
        cargo: v.cargo ?? '',
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.completado.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(
            extraerMensajeError(err, 'No se pudo crear la cuenta del agente.'),
          );
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
