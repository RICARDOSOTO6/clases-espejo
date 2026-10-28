import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { TotpEstado, TotpInicio } from '../../../core/models/auth.models';
import { extraerMensajeError } from '../../../core/utils/http-error.util';

/**
 * Configuración del segundo factor para presidencia y secretaría de la CACE.
 *
 * La cuenta puede activarlo cuando quiera; cuando está activo, el login pide
 * el código después de la contraseña. Los códigos de recuperación se muestran
 * una sola vez.
 */
@Component({
  selector: 'app-seguridad-totp',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './seguridad-totp.component.html',
  styleUrl: './seguridad-totp.component.css',
})
export class SeguridadTotpComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly estado = signal<TotpEstado | null>(null);
  readonly inicio = signal<TotpInicio | null>(null);
  readonly codigos = signal<string[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly mostrarDesactivar = signal(false);

  readonly codigoForm = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly desactivarForm = this.fb.group({
    password: ['', [Validators.required]],
    codigo: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.auth.estadoTotp().subscribe({
      next: (estado) => {
        this.estado.set(estado);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo cargar el segundo factor'));
      },
    });
  }

  iniciar(): void {
    this.guardando.set(true);
    this.error.set(null);
    this.codigos.set([]);
    this.auth.iniciarTotp().subscribe({
      next: (inicio) => {
        this.inicio.set(inicio);
        this.guardando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo iniciar el segundo factor'));
      },
    });
  }

  confirmar(): void {
    if (this.codigoForm.invalid || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.auth.confirmarTotp(this.codigoForm.value.codigo!).subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.codigos.set(res.codigosRecuperacion);
        this.aviso.set(res.mensaje);
        this.inicio.set(null);
        this.codigoForm.reset();
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo confirmar el código'));
      },
    });
  }

  cancelar(): void {
    this.inicio.set(null);
    this.codigoForm.reset();
    this.error.set(null);
  }

  desactivar(): void {
    if (this.desactivarForm.invalid || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.auth
      .desactivarTotp(this.desactivarForm.value.password!, this.desactivarForm.value.codigo!)
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          this.aviso.set(res.mensaje);
          this.mostrarDesactivar.set(false);
          this.desactivarForm.reset();
          this.codigos.set([]);
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(extraerMensajeError(err, 'No se pudo desactivar el segundo factor'));
        },
      });
  }

  copiarCodigos(): void {
    const texto = this.codigos().join('\n');
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(texto);
      this.aviso.set('Códigos copiados. Guárdalos fuera de este equipo.');
    }
  }
}
