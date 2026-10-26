import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretariasService } from '../../core/services/secretarias.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';

/**
 * Invitación de la secretaría de institución. La crea el agente principal.
 * El correo es opcional: el enlace se muestra para copiarlo o compartirlo.
 */
@Component({
  selector: 'app-invitar-secretaria',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="card">
      <div class="card-head">
        <div>
          <p class="cace-eyebrow">Apoyo administrativo</p>
          <h2>Invitar secretaría de institución</h2>
          <p class="muted">
            Una sola persona de apoyo puede mantener el contacto y los docentes. No puede aprobar
            clases, invitar agentes ni emitir certificados.
          </p>
        </div>
      </div>

      @if (enlace(); as link) {
        <div class="alert alert-success" role="status">
          Enlace creado. Cópialo y compártelo por el canal que prefieras.
        </div>
        <div class="form-field">
          <label for="enlace-secretaria">Enlace de invitación</label>
          <input id="enlace-secretaria" type="text" [value]="link" readonly />
        </div>
        <div class="form-grid-actions">
          <button type="button" class="btn btn-primary" (click)="copiar(link)">
            {{ copiado() ? 'Copiado' : 'Copiar enlace' }}
          </button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="crear()" novalidate>
          <div class="form-field">
            <label for="correo-secretaria">Correo de referencia (opcional)</label>
            <input
              id="correo-secretaria"
              type="email"
              formControlName="correo"
              placeholder="Solo para identificar a la persona"
              autocomplete="email"
            />
            <p class="text-sm muted">
              El enlace se genera igualmente aunque no pongas correo. Cópialo al terminar y
              compártelo por WhatsApp o correo.
            </p>
          </div>
          @if (error()) {
            <div class="alert alert-error" role="alert">{{ error() }}</div>
          }
          <button type="submit" class="btn btn-primary" [disabled]="creando()">
            {{ creando() ? 'Creando enlace…' : 'Crear enlace de secretaría' }}
          </button>
        </form>
      }
    </section>
  `,
})
export class InvitarSecretariaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly secretarias = inject(SecretariasService);

  readonly form = this.fb.group({
    correo: ['', [Validators.email]],
  });
  readonly creando = signal(false);
  readonly error = signal<string | null>(null);
  readonly enlace = signal<string | null>(null);
  readonly copiado = signal(false);

  crear(): void {
    if (this.creando()) return;
    this.creando.set(true);
    this.error.set(null);
    const correo = this.form.controls.correo.value?.trim() || undefined;
    this.secretarias.crearInvitacion(correo).subscribe({
      next: (respuesta) => {
        this.creando.set(false);
        this.enlace.set(respuesta.enlace);
      },
      error: (err: HttpErrorResponse) => {
        this.creando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo crear la invitación de secretaría.'));
      },
    });
  }

  async copiar(texto: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.copiado.set(true);
    } catch {
      this.error.set('No se pudo copiar automáticamente. Selecciona el enlace y cópialo.');
    }
  }
}
