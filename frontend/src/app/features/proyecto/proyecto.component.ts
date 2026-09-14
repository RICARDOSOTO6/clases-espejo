import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ProyectosService } from '../../core/services/proyectos.service';
import { MateriasService } from '../../core/services/materias.service';
import { InstitucionesService } from '../../core/services/instituciones.service';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { Asignacion } from '../../core/models/materia.models';
import {
  Mensaje,
  ParticipacionPlanificacion,
  Proyecto,
} from '../../core/models/proyecto.models';

@Component({
  selector: 'app-proyecto',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './proyecto.component.html',
})
export class ProyectoComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly proyectos = inject(ProyectosService);
  private readonly materiasService = inject(MateriasService);
  private readonly instituciones = inject(InstitucionesService);
  private readonly fb = inject(FormBuilder);

  readonly usuario = this.auth.currentUser();
  readonly esAgente = this.usuario?.rol === 'AGENTE';
  readonly esDocente = this.usuario?.rol === 'DOCENTE';
  readonly panelUrl = this.esAgente ? '/agente' : '/docente';

  proyectoId = 0;
  proyecto = signal<Proyecto | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);

  // --- Proyecto (agente) ---
  proyectoForm = this.fb.group({
    estado: ['', Validators.required],
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    plataforma: ['', Validators.required],
  });
  guardandoProyecto = signal(false);

  // --- Docentes del proyecto (agente) ---
  asignaciones = signal<Asignacion[]>([]);
  miInstitucionId = signal<number | null>(null);
  asignacionSeleccionada = this.fb.control<number | null>(null);
  agregandoDocente = signal(false);

  // --- Planificación conjunta ---
  planificacionForm = this.fb.group({
    objetivosAcordados: ['', Validators.required],
    temasAcordados: ['', Validators.required],
    metodologia: ['', Validators.required],
    plataforma: ['', Validators.required],
    estado: ['BORRADOR'],
  });
  guardandoPlanificacion = signal(false);
  confirmando = signal(false);

  // --- Reporte (agente) ---
  reporteForm = this.fb.group({
    acuerdos: ['', Validators.required],
    calendario: ['', Validators.required],
    actividadesAcordadas: ['', Validators.required],
  });
  generandoReporte = signal(false);

  // --- Chat del proyecto ---
  mensajes = signal<Mensaje[]>([]);
  enviandoMensaje = signal(false);
  mensajeForm = this.fb.group({
    contenido: ['', Validators.required],
  });
  private mensajesInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.proyectoId) {
      this.router.navigate([this.panelUrl]);
      return;
    }

    this.cargar();
    this.cargarMensajes();
    this.mensajesInterval = setInterval(() => this.cargarMensajes(), 3000);

    if (this.esAgente) {
      this.materiasService.listarAsignaciones().subscribe({
        next: (r) => this.asignaciones.set(r),
        error: () => this.asignaciones.set([]),
      });
      this.instituciones.obtenerMia().subscribe({
        next: (i) => this.miInstitucionId.set(i.id),
        error: () => {},
      });
    }
  }

  ngOnDestroy(): void {
    if (this.mensajesInterval) clearInterval(this.mensajesInterval);
  }

  cargarMensajes(): void {
    this.proyectos.listarMensajes(this.proyectoId).subscribe({
      next: (r) => this.mensajes.set(r),
      error: () => {},
    });
  }

  enviarMensaje(): void {
    if (this.enviandoMensaje() || this.mensajeForm.invalid) return;
    const contenido = (this.mensajeForm.get('contenido')?.value ?? '').trim();
    if (!contenido) return;

    this.enviandoMensaje.set(true);
    this.proyectos.enviarMensaje(this.proyectoId, contenido).subscribe({
      next: () => {
        this.enviandoMensaje.set(false);
        this.mensajeForm.reset({ contenido: '' });
        this.cargarMensajes();
      },
      error: (err: HttpErrorResponse) => {
        this.enviandoMensaje.set(false);
        this.error.set(extraerMensajeError(err, 'Error al enviar el mensaje'));
      },
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.proyectos.obtener(this.proyectoId).subscribe({
      next: (p) => {
        this.proyecto.set(p);
        this.proyectoForm.patchValue({
          estado: p.estado,
          fechaInicio: this.aFechaInput(p.fechaInicio),
          fechaFin: this.aFechaInput(p.fechaFin),
          plataforma: p.plataforma,
        });
        if (p.planificacion) {
          this.planificacionForm.patchValue({
            objetivosAcordados: p.planificacion.objetivosAcordados,
            temasAcordados: p.planificacion.temasAcordados,
            metodologia: p.planificacion.metodologia,
            plataforma: p.planificacion.plataforma,
            estado: p.planificacion.estado,
          });
        }
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudo cargar el proyecto'),
        );
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // --- Proyecto ---

  guardarProyecto(): void {
    if (this.guardandoProyecto() || this.proyectoForm.invalid) return;
    const v = this.proyectoForm.value;
    this.guardandoProyecto.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos
      .actualizar(this.proyectoId, {
        estado: v.estado ?? undefined,
        fechaInicio: v.fechaInicio ?? undefined,
        fechaFin: v.fechaFin ?? undefined,
        plataforma: v.plataforma ?? undefined,
      })
      .subscribe({
        next: () => {
          this.guardandoProyecto.set(false);
          this.ok.set('Proyecto actualizado');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoProyecto.set(false);
          this.error.set(
            extraerMensajeError(err, 'Error al actualizar el proyecto'),
          );
        },
      });
  }

  // --- Docentes ---

  agregarDocente(): void {
    const asignacionId = this.asignacionSeleccionada.value;
    if (this.agregandoDocente() || asignacionId == null) return;

    this.agregandoDocente.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos
      .agregarDocente(this.proyectoId, {
        asignacionDocenteId: asignacionId,
        rol: this.rolDeInstitucion(),
      })
      .subscribe({
        next: () => {
          this.agregandoDocente.set(false);
          this.asignacionSeleccionada.setValue(null);
          this.ok.set('Docente agregado al proyecto');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.agregandoDocente.set(false);
          this.error.set(extraerMensajeError(err, 'Error al agregar docente'));
        },
      });
  }

  quitarDocente(proyectoDocenteId: number, nombre: string): void {
    if (!window.confirm(`¿Quitar a ${nombre} del proyecto?`)) return;
    this.proyectos.quitarDocente(this.proyectoId, proyectoDocenteId).subscribe({
      next: () => {
        this.ok.set('Docente retirado del proyecto');
        this.cargar();
      },
      error: (err: HttpErrorResponse) =>
        this.error.set(extraerMensajeError(err, 'Error al quitar docente')),
    });
  }

  private rolDeInstitucion(): string {
    const p = this.proyecto();
    const institucionOrigen =
      p?.solicitud.asignacionOrigen.docenteInstitucion.institucion.id;
    return this.miInstitucionId() === institucionOrigen ? 'ORIGEN' : 'DESTINO';
  }

  // --- Planificación ---

  guardarPlanificacion(): void {
    if (this.guardandoPlanificacion() || this.planificacionForm.invalid) return;
    const v = this.planificacionForm.value;
    this.guardandoPlanificacion.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos
      .guardarPlanificacion(this.proyectoId, {
        objetivosAcordados: v.objetivosAcordados ?? '',
        temasAcordados: v.temasAcordados ?? '',
        metodologia: v.metodologia ?? '',
        plataforma: v.plataforma ?? '',
        estado: v.estado ?? undefined,
      })
      .subscribe({
        next: () => {
          this.guardandoPlanificacion.set(false);
          this.ok.set('Planificación guardada');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoPlanificacion.set(false);
          this.error.set(
            extraerMensajeError(err, 'Error al guardar la planificación'),
          );
        },
      });
  }

  confirmarParticipacion(): void {
    if (this.confirmando()) return;
    this.confirmando.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos.confirmarParticipacion(this.proyectoId).subscribe({
      next: () => {
        this.confirmando.set(false);
        this.ok.set('Confirmaste tu participación en la planificación');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.confirmando.set(false);
        this.error.set(
          extraerMensajeError(err, 'Error al confirmar la participación'),
        );
      },
    });
  }

  miParticipacion(): ParticipacionPlanificacion | null {
    const p = this.proyecto();
    if (!p?.planificacion) return null;
    return (
      p.planificacion.participaciones.find(
        (x) =>
          x.proyectoDocente.asignacionDocente.docenteInstitucion.docente
            .usuario.id === this.usuario?.id,
      ) ?? null
    );
  }

  // --- Reporte ---

  generarReporte(): void {
    if (this.generandoReporte() || this.reporteForm.invalid) return;
    const v = this.reporteForm.value;
    this.generandoReporte.set(true);
    this.error.set(null);
    this.ok.set(null);

    this.proyectos
      .generarReporte(this.proyectoId, {
        acuerdos: v.acuerdos ?? '',
        calendario: v.calendario ?? '',
        actividadesAcordadas: v.actividadesAcordadas ?? '',
      })
      .subscribe({
        next: () => {
          this.generandoReporte.set(false);
          this.reporteForm.reset({
            acuerdos: '',
            calendario: '',
            actividadesAcordadas: '',
          });
          this.ok.set('Reporte de planificación generado');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.generandoReporte.set(false);
          this.error.set(extraerMensajeError(err, 'Error al generar el reporte'));
        },
      });
  }

  // --- Helpers de presentación ---

  nombreDocente(item: {
    asignacionDocente: { docenteInstitucion: { docente: { usuario: {
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
    } } } };
  }): string {
    const u = item.asignacionDocente.docenteInstitucion.docente.usuario;
    return `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`;
  }

  nombreAutor(m: Mensaje): string {
    const u = m.autor.asignacionDocente.docenteInstitucion.docente.usuario;
    return `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`;
  }

  esMio(m: Mensaje): boolean {
    return (
      m.autor.asignacionDocente.docenteInstitucion.docente.usuario.id ===
      this.usuario?.id
    );
  }

  estadoProyectoLabel(estado: string): string {
    const labels: Record<string, string> = {
      EN_PLANIFICACION: 'En planificación',
      EN_CURSO: 'En curso',
      FINALIZADO: 'Finalizado',
      CANCELADO: 'Cancelado',
    };
    return labels[estado] ?? estado;
  }

  estadoPlanificacionLabel(estado: string): string {
    const labels: Record<string, string> = {
      BORRADOR: 'Borrador',
      EN_REVISION: 'En revisión',
      APROBADA: 'Aprobada',
    };
    return labels[estado] ?? estado;
  }

  estadoParticipacionLabel(estatus: string): string {
    return estatus === 'CONFIRMADA' ? 'Confirmada' : 'Pendiente';
  }

  formatearFecha(fecha: string | null): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX');
  }

  private aFechaInput(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
}
