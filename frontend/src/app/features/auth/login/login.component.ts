import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { IdentidadCaceService } from '../../../core/services/identidad-cace.service';
import { extraerMensajeError } from '../../../core/utils/http-error.util';
import { mensajeDeControl } from '../../../core/utils/formulario.util';

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
  /**
   * Identidad de la CACE: la portada del acceso es justo lo que se ve antes de
   * entrar, así que tiene que llevar el logo, el lema y el nombre de la
   * comunidad que haya configurado la presidencia (con respaldo si no hay).
   *
   * Los premios **no** salen aquí: se exhiben en la sección «Comunidad», que ya
   * está dentro de la aplicación.
   */
  private readonly identidad = inject(IdentidadCaceService);

  /** Logo, lema y descripción de la CACE, ya con respaldo. */
  readonly logo = this.identidad.logo;
  readonly lema = this.identidad.lema;
  readonly descripcion = this.identidad.descripcion;

  form = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  error = signal<string | null>(null);
  loading = signal(false);
  showPassword = false;
  success = false;
  showRecoveryHint = false;
  /** Mensaje del registro, cuando tiene algo que explicar (alta pendiente…). */
  avisoRegistro = '';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.success = params.has('registrado');
    this.avisoRegistro = params.get('aviso') ?? '';

    const user = this.auth.currentUser();
    if (this.auth.isAuthenticated && user) {
      this.router.navigate(['/panel']);
    }
  }

  mensajeDe(campo: 'correo' | 'password'): string | null {
    return mensajeDeControl(this.form, campo, {
      required: 'Este campo es obligatorio',
      email: 'Introduce un correo válido',
      minlength: 'Mínimo 6 caracteres',
    });
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
      next: () => {
        this.loading.set(false);
        this.form.reset();
        this.router.navigate(['/panel']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(extraerMensajeError(err, 'Error al iniciar sesión'));
        this.form.reset();
      },
    });
  }
}
