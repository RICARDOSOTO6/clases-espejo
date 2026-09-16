import {
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
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
  Actividad,
  Evaluacion,
  Evidencia,
  Mensaje,
  ParticipacionPlanificacion,
  ParticipacionReporte,
  Proyecto,
  ReporteClase,
  Sesion,
} from '../../core/models/proyecto.models';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-proyecto',
  imports: [ReactiveFormsModule, RouterLink, ModalComponent],
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
  chatAbierto = signal(false);

  private readonly chatScroll =
    viewChild<ElementRef<HTMLDivElement>>('chatScroll');
  private ultimoConteoMensajes = 0;

  // --- Sesiones, actividades y evidencias (Semana 6) ---
  sesiones = signal<Sesion[]>([]);
  actividades = signal<Actividad[]>([]);
  evidencias = signal<Evidencia[]>([]);

  sesionForm = this.fb.group({
    titulo: ['', Validators.required],
    fechaHora: ['', Validators.required],
    enlaceVirtual: [
      '',
      [Validators.required, Validators.pattern(/^https?:\/\/.+/i)],
    ],
  });
  actividadForm = this.fb.group({
    titulo: ['', Validators.required],
    instrucciones: ['', Validators.required],
    fechaLimite: ['', Validators.required],
  });
  evidenciaForm = this.fb.group({
    tipo: [''],
    sesionId: this.fb.control<number | null>(null),
  });
  archivoSeleccionado = signal<File | null>(null);

  // --- Reporte de clase, evaluación final y cierre (Semana 7) ---
  reportesClase = signal<ReporteClase[]>([]);
  evaluaciones = signal<Evaluacion[]>([]);

  /** Sesión cuyo reporte de clase se está redactando. */
  sesionReporteAbierta = signal<number | null>(null);
  reporteClaseForm = this.fb.group({
    desarrolloClase: ['', Validators.required],
    totalAsistentes: [0, [Validators.required, Validators.min(0)]],
    incidencias: ['', Validators.required],
    acuerdosSiguienteSesion: ['', Validators.required],
  });

  /** Reporte cuya participación está confirmando el docente. */
  reporteAConfirmar = signal<number | null>(null);
  observacionesForm = this.fb.group({
    observaciones: ['', Validators.required],
  });

  evaluacionForm = this.fb.group({
    instrumento: ['', Validators.required],
    resultado: ['', Validators.required],
    observaciones: ['', Validators.required],
  });
  cerrando = signal(false);

  // Botones que deben bloquearse mientras guardan (evita el doble envío).
  guardandoSesion = signal(false);
  guardandoActividad = signal(false);
  subiendoEvidencia = signal(false);
  guardandoReporteClase = signal(false);
  confirmandoReporteClase = signal(false);
  guardandoEvaluacion = signal(false);

  // Confirmaciones con el mismo modal que usa el resto de la aplicación.
  confirmacion = signal<{
    titulo: string;
    mensaje: string;
    accion: () => void;
  } | null>(null);

  ngOnInit(): void {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.proyectoId) {
      this.router.navigate([this.panelUrl]);
      return;
    }

    this.cargar();
    this.cargarMensajes();
    this.mensajesInterval = setInterval(() => this.cargarMensajes(), 3000);
    this.cargarSesiones();
    this.cargarActividades();
    this.cargarEvidencias();
    this.cargarReportesClase();
    this.cargarEvaluaciones();

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
      next: (r) => {
        const hayNuevos = r.length !== this.ultimoConteoMensajes;
        this.ultimoConteoMensajes = r.length;
        this.mensajes.set(r);
        if (hayNuevos) {
          setTimeout(() => this.scrollChatAbajo());
        }
      },
      error: () => {},
    });
  }

  private scrollChatAbajo(): void {
    const el = this.chatScroll()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  abrirChat(): void {
    this.chatAbierto.set(true);
    setTimeout(() => this.scrollChatAbajo());
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
    if (v.fechaInicio && v.fechaFin && v.fechaFin < v.fechaInicio) {
      this.error.set(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
      return;
    }
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
    this.confirmarAccion(
      'Quitar docente',
      `¿Quitar a ${nombre} del proyecto?`,
      () =>
        this.proyectos
          .quitarDocente(this.proyectoId, proyectoDocenteId)
          .subscribe({
            next: () => {
              this.ok.set('Docente retirado del proyecto');
              this.cargar();
            },
            error: (err: HttpErrorResponse) =>
              this.error.set(extraerMensajeError(err, 'Error al quitar docente')),
          }),
    );
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

  // --- Sesiones, actividades y evidencias (Semana 6) ---

  cargarSesiones(): void {
    this.proyectos.listarSesiones(this.proyectoId).subscribe({
      next: (r) => this.sesiones.set(r),
      error: () => this.sesiones.set([]),
    });
  }

  crearSesion(): void {
    if (this.guardandoSesion() || this.sesionForm.invalid) return;
    const v = this.sesionForm.value;
    this.guardandoSesion.set(true);
    this.error.set(null);
    this.proyectos
      .crearSesion(this.proyectoId, {
        titulo: v.titulo ?? '',
        fechaHora: v.fechaHora ?? '',
        enlaceVirtual: v.enlaceVirtual ?? '',
      })
      .subscribe({
        next: () => {
          this.guardandoSesion.set(false);
          this.sesionForm.reset();
          this.ok.set('Sesión creada');
          this.cargarSesiones();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoSesion.set(false);
          this.error.set(extraerMensajeError(err, 'Error al crear la sesión'));
        },
      });
  }

  eliminarSesion(id: number): void {
    this.confirmarAccion('Eliminar sesión', '¿Eliminar esta sesión?', () =>
      this.proyectos.eliminarSesion(this.proyectoId, id).subscribe({
        next: () => this.cargarSesiones(),
        error: (err: HttpErrorResponse) =>
          this.error.set(
            extraerMensajeError(err, 'Error al eliminar la sesión'),
          ),
      }),
    );
  }

  cargarActividades(): void {
    this.proyectos.listarActividades(this.proyectoId).subscribe({
      next: (r) => this.actividades.set(r),
      error: () => this.actividades.set([]),
    });
  }

  crearActividad(): void {
    if (this.guardandoActividad() || this.actividadForm.invalid) return;
    const v = this.actividadForm.value;
    this.guardandoActividad.set(true);
    this.error.set(null);
    this.proyectos
      .crearActividad(this.proyectoId, {
        titulo: v.titulo ?? '',
        instrucciones: v.instrucciones ?? '',
        fechaLimite: v.fechaLimite ?? '',
      })
      .subscribe({
        next: () => {
          this.guardandoActividad.set(false);
          this.actividadForm.reset();
          this.ok.set('Actividad creada');
          this.cargarActividades();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoActividad.set(false);
          this.error.set(
            extraerMensajeError(err, 'Error al crear la actividad'),
          );
        },
      });
  }

  eliminarActividad(id: number): void {
    this.confirmarAccion('Eliminar actividad', '¿Eliminar esta actividad?', () =>
      this.proyectos.eliminarActividad(this.proyectoId, id).subscribe({
        next: () => this.cargarActividades(),
        error: (err: HttpErrorResponse) =>
          this.error.set(
            extraerMensajeError(err, 'Error al eliminar la actividad'),
          ),
      }),
    );
  }

  cargarEvidencias(): void {
    this.proyectos.listarEvidencias(this.proyectoId).subscribe({
      next: (r) => this.evidencias.set(r),
      error: () => this.evidencias.set([]),
    });
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.item(0) ?? null;
    if (archivo && archivo.size > 10 * 1024 * 1024) {
      this.error.set('El archivo supera el límite de 10 MB');
      this.archivoSeleccionado.set(null);
      input.value = '';
      return;
    }
    this.archivoSeleccionado.set(archivo);
  }

  crearEvidencia(): void {
    const archivo = this.archivoSeleccionado();
    if (!archivo) {
      this.error.set('Selecciona un archivo de evidencia');
      return;
    }
    if (this.subiendoEvidencia()) return;
    const v = this.evidenciaForm.value;
    this.subiendoEvidencia.set(true);
    this.error.set(null);
    this.proyectos
      .crearEvidencia(
        this.proyectoId,
        archivo,
        v.tipo ?? '',
        v.sesionId ?? undefined,
      )
      .subscribe({
        next: () => {
          this.subiendoEvidencia.set(false);
          this.evidenciaForm.reset();
          this.archivoSeleccionado.set(null);
          this.ok.set('Evidencia registrada');
          this.cargarEvidencias();
        },
        error: (err: HttpErrorResponse) => {
          this.subiendoEvidencia.set(false);
          this.error.set(
            extraerMensajeError(err, 'Error al registrar la evidencia'),
          );
        },
      });
  }

  // En desarrollo (frontend en :4200) el archivo vive en el backend (:3000).
  urlArchivo(url: string): string {
    if (url.startsWith('/') && window.location.port === '4200') {
      return `http://${window.location.hostname}:3000${url}`;
    }
    return url;
  }

  nombreArchivo(url: string): string {
    return url.split('/').pop() ?? url;
  }

  tituloSesion(sesionId: number | null): string {
    if (sesionId == null) return 'Sin sesión';
    return this.sesiones().find((s) => s.id === sesionId)?.titulo ?? 'Sesión';
  }

  // --- Reporte de clase, evaluación final y cierre (Semana 7) ---

  cargarReportesClase(): void {
    this.proyectos.listarReportesClase(this.proyectoId).subscribe({
      next: (r) => this.reportesClase.set(r),
      error: () => this.reportesClase.set([]),
    });
  }

  cargarEvaluaciones(): void {
    this.proyectos.listarEvaluaciones(this.proyectoId).subscribe({
      next: (r) => this.evaluaciones.set(r),
      error: () => this.evaluaciones.set([]),
    });
  }

  reporteDeSesion(sesionId: number): ReporteClase | null {
    return this.reportesClase().find((r) => r.sesionId === sesionId) ?? null;
  }

  miParticipacionReporte(reporte: ReporteClase): ParticipacionReporte | null {
    return (
      reporte.participaciones.find(
        (p) =>
          p.proyectoDocente.asignacionDocente.docenteInstitucion.docente.usuario
            .id === this.usuario?.id,
      ) ?? null
    );
  }

  abrirReporte(sesion: Sesion): void {
    const reporte = this.reporteDeSesion(sesion.id);
    this.reporteClaseForm.reset({
      desarrolloClase: reporte?.desarrolloClase ?? '',
      totalAsistentes: reporte?.totalAsistentes ?? 0,
      incidencias: reporte?.incidencias ?? '',
      acuerdosSiguienteSesion: reporte?.acuerdosSiguienteSesion ?? '',
    });
    this.error.set(null);
    this.sesionReporteAbierta.set(sesion.id);
  }

  cerrarReporte(): void {
    this.sesionReporteAbierta.set(null);
  }

  guardarReporteClase(): void {
    const sesionId = this.sesionReporteAbierta();
    if (
      sesionId == null ||
      this.guardandoReporteClase() ||
      this.reporteClaseForm.invalid
    ) {
      return;
    }
    const v = this.reporteClaseForm.value;
    this.guardandoReporteClase.set(true);
    this.error.set(null);
    this.proyectos
      .guardarReporteClase(this.proyectoId, sesionId, {
        desarrolloClase: v.desarrolloClase ?? '',
        totalAsistentes: Number(v.totalAsistentes ?? 0),
        incidencias: v.incidencias ?? '',
        acuerdosSiguienteSesion: v.acuerdosSiguienteSesion ?? '',
      })
      .subscribe({
        next: () => {
          this.guardandoReporteClase.set(false);
          this.sesionReporteAbierta.set(null);
          this.ok.set('Reporte de clase guardado');
          this.cargarReportesClase();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoReporteClase.set(false);
          this.error.set(
            extraerMensajeError(err, 'Error al guardar el reporte de clase'),
          );
        },
      });
  }

  abrirConfirmacion(reporte: ReporteClase): void {
    const mia = this.miParticipacionReporte(reporte);
    this.observacionesForm.reset({ observaciones: mia?.observaciones ?? '' });
    this.error.set(null);
    this.reporteAConfirmar.set(reporte.id);
  }

  cancelarConfirmacion(): void {
    this.reporteAConfirmar.set(null);
  }

  confirmarReporte(reporte: ReporteClase): void {
    if (this.confirmandoReporteClase() || this.observacionesForm.invalid) {
      return;
    }
    const observaciones = this.observacionesForm.value.observaciones ?? '';
    this.confirmandoReporteClase.set(true);
    this.error.set(null);
    this.proyectos
      .confirmarReporteClase(this.proyectoId, reporte.id, observaciones)
      .subscribe({
        next: () => {
          this.confirmandoReporteClase.set(false);
          this.reporteAConfirmar.set(null);
          this.ok.set('Participación confirmada en el reporte');
          this.cargarReportesClase();
        },
        error: (err: HttpErrorResponse) => {
          this.confirmandoReporteClase.set(false);
          this.error.set(
            extraerMensajeError(err, 'Error al confirmar el reporte'),
          );
        },
      });
  }

  crearEvaluacion(): void {
    if (this.guardandoEvaluacion() || this.evaluacionForm.invalid) return;
    const v = this.evaluacionForm.value;
    this.guardandoEvaluacion.set(true);
    this.error.set(null);
    this.proyectos
      .crearEvaluacion(this.proyectoId, {
        instrumento: v.instrumento ?? '',
        resultado: v.resultado ?? '',
        observaciones: v.observaciones ?? '',
      })
      .subscribe({
        next: () => {
          this.guardandoEvaluacion.set(false);
          this.evaluacionForm.reset({
            instrumento: '',
            resultado: '',
            observaciones: '',
          });
          this.ok.set('Evaluación final registrada');
          this.cargarEvaluaciones();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoEvaluacion.set(false);
          this.error.set(
            extraerMensajeError(err, 'Error al registrar la evaluación'),
          );
        },
      });
  }

  cerrarProyecto(): void {
    this.confirmarAccion(
      'Cerrar clase espejo',
      '¿Cerrar la clase espejo? El proyecto pasará al estado Finalizado.',
      () => {
        this.cerrando.set(true);
        this.error.set(null);
        this.ok.set(null);
        this.proyectos.cerrarProyecto(this.proyectoId).subscribe({
          next: () => {
            this.cerrando.set(false);
            this.ok.set('Clase espejo finalizada');
            this.cargar();
          },
          error: (err: HttpErrorResponse) => {
            this.cerrando.set(false);
            this.error.set(
              extraerMensajeError(err, 'Error al cerrar la clase espejo'),
            );
          },
        });
      },
    );
  }

  estadoReporteLabel(estado: string): string {
    const labels: Record<string, string> = {
      BORRADOR: 'Borrador',
      EN_REVISION: 'En revisión',
      CONFIRMADO: 'Confirmado',
    };
    return labels[estado] ?? estado;
  }

  /** Un proyecto cerrado queda en solo lectura. */
  proyectoAbierto(): boolean {
    const p = this.proyecto();
    return !!p && p.estado !== 'FINALIZADO' && p.estado !== 'CANCELADO';
  }

  confirmarAccion(titulo: string, mensaje: string, accion: () => void): void {
    this.confirmacion.set({ titulo, mensaje, accion });
  }

  cerrarConfirmacion(): void {
    this.confirmacion.set(null);
  }

  ejecutarConfirmacion(): void {
    const c = this.confirmacion();
    this.confirmacion.set(null);
    c?.accion();
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

  iniciales(m: Mensaje): string {
    const u = m.autor.asignacionDocente.docenteInstitucion.docente.usuario;
    return `${u.nombres.charAt(0)}${u.apellidoPaterno.charAt(0)}`.toUpperCase();
  }

  horaDe(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        });
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
