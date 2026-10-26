import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { InstitucionesService } from '../../core/services/instituciones.service';
import {
  DocenteSecretaria,
  PerfilSecretaria,
  ResumenSecretaria,
  SecretariasService,
} from '../../core/services/secretarias.service';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { urlDeArchivo } from '../../core/utils/url-archivo.util';

/**
 * Panel acotado de la secretaría de institución: contacto, docentes y conteos.
 * No administra clases, solicitudes, listas nominales ni certificados.
 */
@Component({
  selector: 'app-secretaria-institucion',
  standalone: true,
  imports: [ReactiveFormsModule, LayoutComponent],
  templateUrl: './secretaria-institucion.component.html',
})
export class SecretariaInstitucionComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly secretarias = inject(SecretariasService);
  private readonly instituciones = inject(InstitucionesService);

  readonly usuario = this.auth.currentUser;
  readonly nombreUsuario = signal('');
  readonly perfil = signal<PerfilSecretaria | null>(null);
  readonly docentes = signal<DocenteSecretaria[]>([]);
  readonly resumen = signal<ResumenSecretaria | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly logoSubiendo = signal(false);
  readonly invitando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly enlaceDocente = signal<string | null>(null);
  readonly copiado = signal(false);

  readonly contactoForm = this.fb.group({
    telefono: ['', [Validators.maxLength(30)]],
    correoInstitucional: ['', [Validators.email]],
    estado: ['', [Validators.maxLength(120)]],
    ciudad: ['', [Validators.maxLength(120)]],
  });

  readonly docenteForm = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    numeroEmpleado: ['', [Validators.maxLength(40)]],
  });

  ngOnInit(): void {
    this.nombreUsuario.set(
      `${this.usuario()?.nombres ?? ''} ${this.usuario()?.apellidoPaterno ?? ''}`.trim(),
    );
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      perfil: this.secretarias.perfil(),
      docentes: this.secretarias.listarDocentes(),
      resumen: this.secretarias.resumen(),
    }).subscribe({
      next: ({ perfil, docentes, resumen }) => {
        this.perfil.set(perfil);
        this.docentes.set(docentes);
        this.resumen.set(resumen);
        this.contactoForm.patchValue({
          telefono: perfil.institucion.telefono,
          correoInstitucional: perfil.institucion.correoInstitucional,
          estado: perfil.institucion.estado,
          ciudad: perfil.institucion.ciudad,
        });
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo cargar el panel de secretaría.'));
      },
    });
  }

  guardarContacto(): void {
    if (this.contactoForm.invalid || this.guardando()) {
      this.contactoForm.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.secretarias
      .actualizarContacto({
        telefono: this.contactoForm.controls.telefono.value ?? undefined,
        correoInstitucional: this.contactoForm.controls.correoInstitucional.value ?? undefined,
        estado: this.contactoForm.controls.estado.value ?? undefined,
        ciudad: this.contactoForm.controls.ciudad.value ?? undefined,
      })
      .subscribe({
        next: (respuesta) => {
          this.guardando.set(false);
          this.aviso.set(respuesta.mensaje);
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(extraerMensajeError(err, 'No se pudieron guardar los datos de contacto.'));
        },
      });
  }

  invitarDocente(): void {
    if (this.docenteForm.invalid || this.invitando()) {
      this.docenteForm.markAllAsTouched();
      return;
    }
    this.invitando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.enlaceDocente.set(null);
    const { correo, numeroEmpleado } = this.docenteForm.getRawValue();
    this.secretarias.invitarDocente(correo ?? '', numeroEmpleado ?? undefined).subscribe({
      next: (respuesta) => {
        this.invitando.set(false);
        this.enlaceDocente.set(respuesta.enlace);
        this.aviso.set(respuesta.mensaje);
        this.docenteForm.reset();
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.invitando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo invitar al docente.'));
      },
    });
  }

  cambiarEstado(docente: DocenteSecretaria): void {
    this.error.set(null);
    this.secretarias.cambiarEstadoDocente(docente.id, !docente.activo).subscribe({
      next: () => this.cargar(),
      error: (err: HttpErrorResponse) => {
        this.error.set(extraerMensajeError(err, 'No se pudo cambiar el estado del docente.'));
      },
    });
  }

  async copiarEnlace(): Promise<void> {
    const enlace = this.enlaceDocente();
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      this.copiado.set(true);
    } catch {
      this.error.set('Selecciona el enlace y cópialo manualmente.');
    }
  }

  subirLogo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo || this.logoSubiendo()) return;
    this.logoSubiendo.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.instituciones.subirLogo(archivo).subscribe({
      next: () => {
        this.logoSubiendo.set(false);
        this.aviso.set('Logo actualizado.');
        entrada.value = '';
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.logoSubiendo.set(false);
        entrada.value = '';
        this.error.set(extraerMensajeError(err, 'No se pudo subir el logo.'));
      },
    });
  }

  quitarLogo(): void {
    if (!this.perfil()?.institucion.logoUrl) return;
    if (!confirm('¿Quitar el logo de la institución?')) return;
    this.logoSubiendo.set(true);
    this.error.set(null);
    this.instituciones.quitarLogo().subscribe({
      next: () => {
        this.logoSubiendo.set(false);
        this.aviso.set('Logo eliminado.');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.logoSubiendo.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo quitar el logo.'));
      },
    });
  }

  logoUrl(): string | null {
    const logo = this.perfil()?.institucion.logoUrl;
    return logo ? urlDeArchivo(logo) : null;
  }

  logout(): void {
    this.auth.logout();
  }
}
