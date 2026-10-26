import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  EnlaceInvitacionAgente,
  InvitacionesAgenteService,
  InvitacionAgentePendiente,
} from '../../core/services/invitaciones-agente.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';

/**
 * La presidencia invita al agente fundador de una institución. El agente
 * completará los datos institucionales en el cuestionario público.
 */
@Component({
  selector: 'app-invitar-agente',
  standalone: true,
  imports: [DatePipe],
  template: `
    <section class="card">
      <div class="card-head">
        <div>
          <p class="cace-eyebrow">Alta de institución</p>
          <h2>Invitar agente fundador</h2>
          <p class="muted">
            Comparte el enlace con la persona que coordinará la institución. Ella
            completará los datos y la institución quedará pendiente de tu
            aprobación.
          </p>
        </div>
      </div>

      <button type="button" class="btn btn-primary" (click)="crear()" [disabled]="creando()">
        {{ creando() ? 'Creando enlace…' : 'Crear enlace de agente' }}
      </button>

      @if (enlace(); as link) {
        <div class="alert alert-success" role="status">
          Enlace creado. Cópialo y compártelo; no se envía correo automáticamente.
        </div>
        <div class="form-field">
          <label for="enlace-agente">Enlace para el agente</label>
          <input id="enlace-agente" type="text" [value]="link" readonly />
        </div>
        <button type="button" class="btn btn-primary" (click)="copiar(link)">
          {{ copiado() ? 'Copiado' : 'Copiar enlace' }}
        </button>
      }

      @if (pendientes().length > 0) {
        <h3 class="subtitle">Enlaces pendientes</h3>
        <ul class="lista">
          @for (item of pendientes(); track item.id) {
            <li class="lista-item">
              <div>
                <strong>Enlace de agente #{{ item.id }}</strong>
                <div class="muted">Vence: {{ item.expiracion | date: 'short' }}</div>
              </div>
              <button type="button" class="btn btn-secondary" (click)="revocar(item)">
                Revocar
              </button>
            </li>
          }
        </ul>
      }

      @if (error()) {
        <div class="alert alert-error" role="alert">{{ error() }}</div>
      }
      @if (aviso()) {
        <div class="alert alert-success" role="status">{{ aviso() }}</div>
      }
    </section>
  `,
})
export class InvitarAgenteComponent implements OnInit {
  private readonly invitaciones = inject(InvitacionesAgenteService);

  readonly creando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly enlace = signal<string | null>(null);
  readonly copiado = signal(false);
  readonly pendientes = signal<InvitacionAgentePendiente[]>([]);
  private ultima: EnlaceInvitacionAgente | null = null;

  ngOnInit(): void {
    this.cargarPendientes();
  }

  cargarPendientes(): void {
    this.invitaciones.listar().subscribe({
      next: (pendientes) => this.pendientes.set(pendientes),
      error: () => undefined,
    });
  }

  crear(): void {
    if (this.creando()) return;
    this.creando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.invitaciones.crear().subscribe({
      next: (respuesta) => {
        this.creando.set(false);
        this.ultima = respuesta;
        this.enlace.set(respuesta.enlace);
        this.aviso.set(respuesta.mensaje);
        this.cargarPendientes();
      },
      error: (err: HttpErrorResponse) => {
        this.creando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo crear el enlace.'));
      },
    });
  }

  revocar(item: InvitacionAgentePendiente): void {
    if (!confirm('¿Revocar este enlace de agente?')) return;
    this.error.set(null);
    this.aviso.set(null);
    this.invitaciones.revocar(item.id).subscribe({
      next: (respuesta) => {
        this.aviso.set(respuesta.mensaje);
        if (this.ultima?.id === item.id) this.enlace.set(null);
        this.cargarPendientes();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(extraerMensajeError(err, 'No se pudo revocar el enlace.'));
      },
    });
  }

  async copiar(texto: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.copiado.set(true);
    } catch {
      this.error.set('Selecciona el enlace y cópialo manualmente.');
    }
  }
}
