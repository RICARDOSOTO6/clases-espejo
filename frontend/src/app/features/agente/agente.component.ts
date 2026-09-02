import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { AgentesService } from '../../core/services/agentes.service';
import { InviteDocenteDto } from '../../core/models/auth.models';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-agente',
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './agente.component.html',
})
export class AgenteComponent {
  private readonly auth = inject(AuthService);
  private readonly agentes = inject(AgentesService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  usuario = this.auth.currentUser();

  showInviteModal = false;
  inviteLoading = signal(false);
  inviteError = signal<string | null>(null);
  inviteSuccess = signal<string | null>(null);

  inviteForm = this.fb.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    gradoAcademico: ['', Validators.required],
    especialidad: ['', Validators.required],
    numeroEmpleado: ['', Validators.required],
  });

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  openInvite(): void {
    this.showInviteModal = true;
    this.inviteError.set(null);
    this.inviteSuccess.set(null);
    this.inviteForm.reset();
  }

  closeInvite(): void {
    this.showInviteModal = false;
  }

  submitInvite(): void {
    if (this.inviteLoading()) return;
    if (this.inviteForm.invalid) return;

    this.inviteLoading.set(true);
    this.inviteError.set(null);
    this.inviteSuccess.set(null);

    this.agentes
      .invitarDocente(this.inviteForm.value as InviteDocenteDto)
      .subscribe({
        next: (res) => {
          this.inviteLoading.set(false);
          this.inviteSuccess.set(`Invitación enviada a ${res.correo}`);
          this.inviteForm.reset();
        },
        error: (err: HttpErrorResponse) => {
          this.inviteLoading.set(false);
          this.inviteError.set(
            extraerMensajeError(err, 'Error al invitar docente'),
          );
        },
      });
  }
}
