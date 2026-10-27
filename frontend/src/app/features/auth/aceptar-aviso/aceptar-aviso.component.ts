import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IdentidadCaceService } from '../../../core/services/identidad-cace.service';
import { extraerMensajeError } from '../../../core/utils/http-error.util';

/**
 * Aceptación obligatoria del aviso para cuentas creadas antes de la versión
 * vigente. Sin esto no se entra al panel: la aceptación se guarda en el
 * servidor y la sesión local se actualiza al terminar.
 */
@Component({
  selector: 'app-aceptar-aviso',
  imports: [RouterLink],
  templateUrl: './aceptar-aviso.component.html',
})
export class AceptarAvisoComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly identidad = inject(IdentidadCaceService);

  readonly logo = this.identidad.logo;
  readonly lema = this.identidad.lema;
  readonly descripcion = this.identidad.descripcion;

  readonly acepta = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.auth.isAuthenticated) {
      this.router.navigate(['/login']);
      return;
    }

    const usuario = this.auth.currentUser();
    if (usuario?.debeAceptarAviso === false) {
      this.router.navigate(['/panel']);
    }
  }

  aceptar(): void {
    if (!this.acepta() || this.guardando()) return;

    this.guardando.set(true);
    this.error.set(null);

    this.auth.aceptarAviso().subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.auth.marcarAvisoAceptado(res.aceptoAvisoVersion);
        this.router.navigate(['/panel']);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo guardar la aceptación del aviso'));
      },
    });
  }

  salir(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
