import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  SecretariaActual,
  SecretariasService,
} from '../../core/services/secretarias.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';

/**
 * Administración de la secretaría de institución desde el panel del agente
 * principal. No se pide correo: solo se genera un enlace para copiar.
 */
@Component({
  selector: 'app-invitar-secretaria',
  standalone: true,
  imports: [],
  template: `
    <section class="card">
      <div class="card-head">
        <div>
          <p class="cace-eyebrow">Apoyo administrativo</p>
          <h2>Secretaría de institución</h2>
          <p class="muted">
            Una sola persona de apoyo mantiene el contacto y los docentes. No
            puede aprobar clases, invitar agentes ni emitir certificados.
          </p>
        </div>
      </div>

      @if (cargando()) {
        <p class="muted">Cargando la secretaría…</p>
      } @else if (actual(); as a) {
        @if (a.secretaria?.activo) {
          <div class="alert alert-success" role="status">
            Secretaría activa: <strong>{{ a.secretaria?.nombre }}</strong>
            · {{ a.secretaria?.correo }}
          </div>
          <div class="form-grid-actions">
            <button type="button" class="btn btn-secondary" (click)="desactivar()">
              Desactivar secretaría
            </button>
          </div>
        } @else {
          <p class="muted">La institución no tiene una secretaría activa.</p>
          @if (a.invitacionPendiente) {
            <p class="text-sm muted">
              Hay un enlace pendiente. Puedes recuperarlo o revocarlo.
            </p>
            <div class="form-grid-actions">
              <button type="button" class="btn btn-primary" (click)="crear()">
                Mostrar enlace pendiente
              </button>
              <button type="button" class="btn btn-secondary" (click)="revocar()">
                Revocar enlace
              </button>
            </div>
          } @else {
            <button type="button" class="btn btn-primary" (click)="crear()" [disabled]="creando()">
              {{ creando() ? 'Creando enlace…' : 'Crear enlace de invitación' }}
            </button>
          }
        }

        @if (enlace(); as link) {
          <div class="form-field">
            <label for="enlace-secretaria">Enlace de invitación</label>
            <input id="enlace-secretaria" type="text" [value]="link" readonly />
          </div>
          <div class="form-grid-actions">
            <button type="button" class="btn btn-primary" (click)="copiar(link)">
              {{ copiado() ? 'Copiado' : 'Copiar enlace' }}
            </button>
            @if (a.invitacionPendiente) {
              <button type="button" class="btn btn-secondary" (click)="revocar()">
                Revocar enlace
              </button>
            }
          </div>
        }
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
export class InvitarSecretariaComponent implements OnInit {
  private readonly secretarias = inject(SecretariasService);

  readonly actual = signal<SecretariaActual | null>(null);
  readonly cargando = signal(true);
  readonly creando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly enlace = signal<string | null>(null);
  readonly copiado = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.secretarias.actual().subscribe({
      next: (actual) => {
        this.actual.set(actual);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudo consultar la secretaría.'),
        );
      },
    });
  }

  crear(): void {
    if (this.creando()) return;
    this.creando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.secretarias.crearInvitacion().subscribe({
      next: (respuesta) => {
        this.creando.set(false);
        this.enlace.set(respuesta.enlace);
        this.aviso.set(respuesta.mensaje);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.creando.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudo crear la invitación de secretaría.'),
        );
      },
    });
  }

  desactivar(): void {
    if (!confirm('¿Desactivar a la secretaría actual? Su enlace dejará de funcionar.')) {
      return;
    }
    this.error.set(null);
    this.aviso.set(null);
    this.enlace.set(null);
    this.secretarias.desactivar().subscribe({
      next: (respuesta) => {
        this.aviso.set(respuesta.mensaje);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(
          extraerMensajeError(err, 'No se pudo desactivar la secretaría.'),
        );
      },
    });
  }

  revocar(): void {
    const pendiente = this.actual()?.invitacionPendiente;
    if (!pendiente) return;
    if (!confirm('¿Revocar el enlace pendiente? Ya no podrá usarse.')) return;
    this.error.set(null);
    this.aviso.set(null);
    this.enlace.set(null);
    this.secretarias.revocarInvitacion(pendiente.id).subscribe({
      next: (respuesta) => {
        this.aviso.set(respuesta.mensaje);
        this.cargar();
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
      this.error.set(
        'No se pudo copiar automáticamente. Selecciona el enlace y cópialo.',
      );
    }
  }
}
