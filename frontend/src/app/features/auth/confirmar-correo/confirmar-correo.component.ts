import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { IdentidadCaceService } from '../../../core/services/identidad-cace.service';
import { extraerMensajeError } from '../../../core/utils/http-error.util';

/**
 * Pantalla del enlace de confirmación de correo (`/confirmar-correo?token=…`).
 *
 * Sirve para las dos cosas: confirmar la cuenta recién registrada y confirmar
 * una dirección nueva al cambiar de correo. El servidor decide cuál es según el
 * correo del token, y aquí solo se enseña el resultado.
 */
@Component({
  selector: 'app-confirmar-correo',
  imports: [RouterLink],
  templateUrl: './confirmar-correo.component.html',
})
export class ConfirmarCorreoComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly identidad = inject(IdentidadCaceService);

  readonly logo = this.identidad.logo;
  readonly lema = this.identidad.lema;
  readonly descripcion = this.identidad.descripcion;

  estado = signal<'comprobando' | 'hecho' | 'error'>('comprobando');
  mensaje = signal('');
  correo = signal('');
  esCambio = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.estado.set('error');
      this.error.set(
        'Falta el código del enlace. Abre el enlace completo del correo de confirmación.',
      );
      return;
    }

    this.auth.confirmarCorreo(token).subscribe({
      next: (res) => {
        this.mensaje.set(res.mensaje);
        this.correo.set(res.correo);
        this.esCambio.set(res.tipo === 'CAMBIO');
        this.estado.set('hecho');
      },
      error: (err: HttpErrorResponse) => {
        this.estado.set('error');
        this.error.set(
          extraerMensajeError(
            err,
            'El enlace de confirmación no es válido o caducó.',
          ),
        );
      },
    });
  }
}
