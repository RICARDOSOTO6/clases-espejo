import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CaceService, DecisionCace, InstitucionCace } from '../../core/services/cace.service';
import { IdentidadCaceService } from '../../core/services/identidad-cace.service';
import { PendienteUi, UiStateService } from '../../core/services/ui-state.service';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import {
  InstitucionOpcion,
  PaisComunidad,
  Premio,
} from '../../core/models/cace-identidad.models';
import { TEMAS_CACE, TemaCace } from '../../core/constants/cace';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { fechaHoraLarga } from '../../core/utils/fecha.util';
import { urlDeArchivo } from '../../core/utils/url-archivo.util';
import { prepararLogo } from '../../core/utils/imagen.util';

/** Decisión que exige motivo: el correo al agente lo lleva escrito. */
type DecisionConMotivo = 'rechazar' | 'vetar';

/**
 * Peso máximo de la imagen original antes de prepararla. El navegador la reduce
 * (a 512 px de lado mayor) y el servidor solo admite 2 MB, así que este tope es
 * para avisar antes de subir una foto de móvil de varios megas.
 */
const PESO_MAXIMO_IMAGEN = 12 * 1024 * 1024;

/**
 * Primera pantalla del presidente de la CACE.
 *
 * Usa el esqueleto `<app-layout>` con el rol de la CACE (`PRESIDENTE_CACE` o
 * `SECRETARIA_CACE`), así que tiene barra superior, campana de pendientes y
 * menú lateral propios. La campana se llena con lo que publica esta pantalla
 * (`publicarEnCampana`), igual que hacen las pantallas de docente y agente.
 *
 * Aquí está el cambio de contraseña obligatorio del primer acceso, la gestión
 * de instituciones (aprobar, rechazar, vetar y reactivar) y la identidad de la
 * CACE: personalización (logo, textos y tema), banderas de la comunidad y
 * premios.
 */
@Component({
  selector: 'app-cace',
  imports: [ReactiveFormsModule, LayoutComponent],
  templateUrl: './cace.component.html',
  styleUrl: './cace.component.css',
})
export class CaceComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly cace = inject(CaceService);
  /** Identidad pública: la portada, el logo de la barra y el tema aplicado. */
  private readonly identidad = inject(IdentidadCaceService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  /** Estado compartido con el esqueleto (la campana de pendientes). */
  private readonly ui = inject(UiStateService);
  /** Para desuscribirse de los cambios del formulario al salir de la pantalla. */
  private readonly destroyRef = inject(DestroyRef);

  /** La sesión es la fuente de verdad: al cambiarla, esto se actualiza solo. */
  readonly usuario = this.auth.currentUser;
  readonly debeCambiarPassword = computed(
    () => this.auth.currentUser()?.debeCambiarPassword === true,
  );

  /**
   * Rol con el que el esqueleto dibuja el menú. La presidencia y la secretaría
   * comparten pantalla; el menú es el mismo para las dos.
   */
  readonly rolCace = computed<'PRESIDENTE_CACE' | 'SECRETARIA_CACE'>(() =>
    this.auth.currentUser()?.rol === 'SECRETARIA_CACE'
      ? 'SECRETARIA_CACE'
      : 'PRESIDENTE_CACE',
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);

  // --- Instituciones ---
  readonly instituciones = signal<InstitucionCace[]>([]);
  readonly cargando = signal(false);
  readonly errorInstituciones = signal<string | null>(null);
  readonly avisoInstituciones = signal<string | null>(null);
  /** Institución cuya decisión está en curso (evita el doble clic). */
  readonly enProceso = signal<number | null>(null);
  /** Institución a la que se le está pidiendo el motivo, y para qué. */
  readonly pidiendoMotivo = signal<{
    id: number;
    nombre: string;
    decision: DecisionConMotivo;
  } | null>(null);
  /** Institución rechazada cuyo borrado definitivo se está confirmando. */
  readonly pidiendoBorrado = signal<InstitucionCace | null>(null);

  readonly pendientes = computed(() =>
    this.instituciones().filter((i) => i.estadoCace === 'PENDIENTE'),
  );

  form = this.fb.group({
    actual: ['', Validators.required],
    nueva: ['', [Validators.required, Validators.minLength(8)]],
    confirmar: ['', Validators.required],
  });

  /** Motivo del rechazo o del veto que se está escribiendo. */
  readonly motivo = this.fb.control('', Validators.required);

  // --- Personalización (lema, descripción, tema y logo) ---

  /** Los temas disponibles, con su etiqueta, para pintar las opciones. */
  readonly temas = TEMAS_CACE;
  /** Tema elegido en el formulario, para la vista previa. */
  readonly temaElegido = signal<TemaCace>('AZUL');
  readonly guardandoPersonalizacion = signal(false);
  readonly errorPersonalizacion = signal<string | null>(null);
  readonly avisoPersonalizacion = signal<string | null>(null);
  readonly subiendoLogo = signal(false);

  formPersonalizacion = this.fb.group({
    lema: ['', Validators.maxLength(160)],
    descripcion: ['', Validators.maxLength(600)],
    tema: this.fb.nonNullable.control<TemaCace>('AZUL'),
  });

  /** Logo configurado (o el de respaldo), listo para la vista previa. */
  readonly logoActual = this.identidad.logo;
  /** Lema que se está escribiendo, para que la vista previa lo siga. */
  readonly lemaVistaPrevia = signal('');

  // --- Banderas de la comunidad ---

  readonly paises = signal<PaisComunidad[]>([]);
  readonly cargandoPaises = signal(false);
  readonly errorPaises = signal<string | null>(null);
  readonly avisoPaises = signal<string | null>(null);
  /** País que se está editando en la lista (`null` = ninguno). */
  readonly paisEnEdicion = signal<number | null>(null);
  /** País cuyo borrado se está confirmando: es irreversible. */
  readonly paisAEliminar = signal<PaisComunidad | null>(null);

  formPais = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    orden: this.fb.nonNullable.control(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(999),
    ]),
    activo: this.fb.nonNullable.control(true),
  });

  // --- Premios y reconocimientos ---

  readonly premios = signal<Premio[]>([]);
  /** Instituciones para el desplegable del formulario de premios. */
  readonly institucionesOpcion = signal<InstitucionOpcion[]>([]);
  readonly cargandoPremios = signal(false);
  readonly errorPremios = signal<string | null>(null);
  readonly avisoPremios = signal<string | null>(null);
  /** Premio que se está editando (`null` = se está creando uno nuevo). */
  readonly premioEnEdicion = signal<number | null>(null);
  readonly premioAEliminar = signal<Premio | null>(null);
  /** Premio cuya imagen se está subiendo (evita el doble clic). */
  readonly subiendoImagen = signal<number | null>(null);

  formPremio = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: ['', Validators.maxLength(1500)],
    anio: this.fb.control<number | null>(new Date().getFullYear(), [
      Validators.required,
      Validators.min(1900),
      Validators.max(2100),
    ]),
    otorgadoA: ['', [Validators.required, Validators.minLength(2)]],
    institucionId: this.fb.control<number | null>(null),
    orden: this.fb.nonNullable.control(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(999),
    ]),
    publicado: this.fb.nonNullable.control(false),
  });

  /** Un premio sin publicar es un borrador: solo lo ve la presidencia. */
  readonly borradores = computed(
    () => this.premios().filter((premio) => !premio.publicado).length,
  );

  ngOnInit(): void {
    // Mientras no cambie la contraseña provisional, el panel no se usa.
    if (!this.debeCambiarPassword()) {
      this.cargarInstituciones();
      this.cargarIdentidad();
      this.cargarPaises();
      this.cargarPremios();
    }

    // El tema se elige en el formulario y se enseña en la vista previa: aquí se
    // copia a una señal para que la previa siga al formulario mientras se
    // escribe, sin guardar nada todavía.
    this.formPersonalizacion.controls.tema.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tema) => this.temaElegido.set(tema));
    this.formPersonalizacion.controls.lema.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lema) => this.lemaVistaPrevia.set(lema ?? ''));
  }

  ngOnDestroy(): void {
    // Al salir no se dejan pendientes de otra pantalla en la campana.
    this.ui.limpiarPantalla();
  }

  get nombreUsuario(): string {
    const u = this.usuario();
    return u
      ? `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`.trim()
      : '';
  }

  mensajeDe(campo: 'actual' | 'nueva' | 'confirmar'): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['minlength']) return 'Mínimo 8 caracteres';
    return null;
  }

  submit(): void {
    if (this.loading()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { actual, nueva, confirmar } = this.form.value;

    // Se comprueba aquí lo que el servidor no puede saber: que la
    // confirmación coincida. El mínimo de 8 ya lo valida el propio formulario.
    if (nueva !== confirmar) {
      this.error.set('La confirmación no coincide con la nueva contraseña');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.exito.set(null);

    this.auth.cambiarPassword(actual!, nueva!).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.exito.set(res.mensaje);
        this.form.reset();
        // Ya se puede usar el panel: se carga la sección de instituciones.
        this.cargarInstituciones();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudo cambiar la contraseña'),
        );
      },
    });
  }

  // --- Instituciones: datos ---

  cargarInstituciones(): void {
    this.cargando.set(true);
    this.errorInstituciones.set(null);
    this.cace.listarInstituciones().subscribe({
      next: (lista) => {
        this.instituciones.set(lista);
        this.cargando.set(false);
        this.publicarEnCampana();
      },
      error: (err: HttpErrorResponse) => {
        this.instituciones.set([]);
        this.cargando.set(false);
        this.errorInstituciones.set(
          extraerMensajeError(err, 'No se pudieron cargar las instituciones'),
        );
        this.publicarEnCampana();
      },
    });
  }

  // --- Instituciones: decisiones ---

  aprobar(institucion: InstitucionCace): void {
    this.ejecutar(this.cace.aprobar(institucion.id), institucion.id);
  }

  reactivar(institucion: InstitucionCace): void {
    this.ejecutar(this.cace.reactivar(institucion.id), institucion.id);
  }

  /** Rechazar y vetar exigen motivo: se pide antes de enviar nada. */
  pedirMotivo(institucion: InstitucionCace, decision: DecisionConMotivo): void {
    this.motivo.reset('');
    this.avisoInstituciones.set(null);
    this.errorInstituciones.set(null);
    this.pidiendoMotivo.set({
      id: institucion.id,
      nombre: institucion.nombre,
      decision,
    });
  }

  cancelarMotivo(): void {
    this.pidiendoMotivo.set(null);
    this.motivo.reset('');
  }

  confirmarMotivo(): void {
    const pendiente = this.pidiendoMotivo();
    if (!pendiente) return;

    const motivo = (this.motivo.value ?? '').trim();
    if (!motivo) {
      this.motivo.markAsTouched();
      return;
    }

    this.ejecutar(
      pendiente.decision === 'rechazar'
        ? this.cace.rechazar(pendiente.id, motivo)
        : this.cace.vetar(pendiente.id, motivo),
      pendiente.id,
    );
  }

  private ejecutar(peticion: Observable<DecisionCace>, id: number): void {
    if (this.enProceso() !== null) return;

    this.enProceso.set(id);
    this.avisoInstituciones.set(null);
    this.errorInstituciones.set(null);

    peticion.subscribe({
      next: (res) => {
        this.enProceso.set(null);
        this.pidiendoMotivo.set(null);
        this.motivo.reset('');
        this.avisoInstituciones.set(res.mensaje);
        // El estado y quién lo decidió los pone el servidor: se recarga la lista.
        this.cargarInstituciones();
      },
      error: (err: HttpErrorResponse) => {
        this.enProceso.set(null);
        this.errorInstituciones.set(extraerMensajeError(err, 'No se pudo completar la decisión'));
      },
    });
  }

  // --- Borrado definitivo (solo instituciones rechazadas y sin historia) ---

  /** El borrado es irreversible: se confirma antes de enviarlo. */
  pedirBorrado(institucion: InstitucionCace): void {
    this.avisoInstituciones.set(null);
    this.errorInstituciones.set(null);
    this.pidiendoBorrado.set(institucion);
  }

  cancelarBorrado(): void {
    this.pidiendoBorrado.set(null);
  }

  confirmarBorrado(): void {
    const institucion = this.pidiendoBorrado();
    if (!institucion || this.enProceso() !== null) return;

    this.enProceso.set(institucion.id);
    this.avisoInstituciones.set(null);
    this.errorInstituciones.set(null);

    this.cace.eliminarInstitucion(institucion.id).subscribe({
      next: (res) => {
        this.enProceso.set(null);
        this.pidiendoBorrado.set(null);
        this.avisoInstituciones.set(res.mensaje);
        this.cargarInstituciones();
      },
      error: (err: HttpErrorResponse) => {
        this.enProceso.set(null);
        this.pidiendoBorrado.set(null);
        // El servidor explica qué historia lo impide, o que no estaba rechazada.
        this.errorInstituciones.set(
          extraerMensajeError(err, 'No se pudo borrar la institución'),
        );
      },
    });
  }

  /** URL del logo lista para un `<img>`. */
  logoDe(institucion: InstitucionCace): string | null {
    return urlDeArchivo(institucion.logoUrl);
  }

  // --- Personalización ---

  /** Rellena el formulario con lo que ya está configurado. */
  cargarIdentidad(): void {
    this.errorPersonalizacion.set(null);
    this.identidad.cargar().subscribe({
      next: (config) => {
        this.formPersonalizacion.patchValue({
          lema: config.lema,
          descripcion: config.descripcion,
          tema: config.tema,
        });
        this.temaElegido.set(config.tema);
        this.lemaVistaPrevia.set(config.lema);
      },
      error: (err: HttpErrorResponse) => {
        this.errorPersonalizacion.set(
          extraerMensajeError(err, 'No se pudo cargar la personalización'),
        );
      },
    });
  }

  /** Guarda lema, descripción y tema. */
  guardarPersonalizacion(): void {
    if (this.guardandoPersonalizacion()) return;

    if (this.formPersonalizacion.invalid) {
      this.formPersonalizacion.markAllAsTouched();
      return;
    }

    const { lema, descripcion, tema } = this.formPersonalizacion.getRawValue();
    this.guardandoPersonalizacion.set(true);
    this.errorPersonalizacion.set(null);
    this.avisoPersonalizacion.set(null);

    this.cace
      .actualizarConfiguracion({
        lema: lema ?? '',
        descripcion: descripcion ?? '',
        tema,
      })
      .subscribe({
        next: () => {
          this.guardandoPersonalizacion.set(false);
          this.avisoPersonalizacion.set(
            'Personalización guardada: el tema y los textos ya se ven en toda la aplicación.',
          );
          this.recargarIdentidadPublica();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoPersonalizacion.set(false);
          this.errorPersonalizacion.set(
            extraerMensajeError(err, 'No se pudo guardar la personalización'),
          );
        },
      });
  }

  /**
   * Vuelve a pedir la identidad pública. Es lo que aplica el tema nuevo al
   * documento y actualiza el logo de la barra superior: se hace después de
   * guardar, no antes, para no dejar la aplicación a medias si la petición falla.
   */
  private recargarIdentidadPublica(): void {
    this.identidad.cargar(true).subscribe({
      next: (config) => this.temaElegido.set(config.tema),
      error: () => {},
    });
  }

  /**
   * Sube el logo: primero se prepara en el navegador (se reduce y se convierte a
   * PNG, igual que el logo de la institución) y después se manda.
   */
  async alSeleccionarLogo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    // Permite volver a elegir el mismo archivo después de un error.
    entrada.value = '';
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      this.errorPersonalizacion.set(
        'Elige una imagen (PNG, JPG o WEBP). Un archivo .svg no sirve: puede llevar código dentro.',
      );
      return;
    }
    if (archivo.size > PESO_MAXIMO_IMAGEN) {
      this.errorPersonalizacion.set('La imagen es demasiado grande (máximo 12 MB).');
      return;
    }

    this.subiendoLogo.set(true);
    this.errorPersonalizacion.set(null);
    this.avisoPersonalizacion.set(null);

    let preparado: File;
    try {
      preparado = await prepararLogo(archivo);
    } catch {
      this.subiendoLogo.set(false);
      this.errorPersonalizacion.set(
        'No se pudo leer la imagen. Prueba con otra en PNG o JPG.',
      );
      return;
    }

    this.cace.subirLogo(preparado).subscribe({
      next: () => {
        this.subiendoLogo.set(false);
        this.avisoPersonalizacion.set('Logo de la CACE actualizado.');
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoLogo.set(false);
        this.errorPersonalizacion.set(
          extraerMensajeError(err, 'No se pudo subir el logo'),
        );
      },
    });
  }

  /** Quita el logo: la aplicación vuelve al logo de respaldo. */
  quitarLogo(): void {
    if (this.subiendoLogo()) return;

    this.subiendoLogo.set(true);
    this.errorPersonalizacion.set(null);
    this.avisoPersonalizacion.set(null);

    this.cace.quitarLogo().subscribe({
      next: (res) => {
        this.subiendoLogo.set(false);
        this.avisoPersonalizacion.set(res.mensaje);
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoLogo.set(false);
        this.errorPersonalizacion.set(
          extraerMensajeError(err, 'No se pudo quitar el logo'),
        );
      },
    });
  }

  /** Lema de la vista previa: lo que se escribe o, si está vacío, el actual. */
  get lemaVistaPreviaTexto(): string {
    return this.lemaVistaPrevia().trim() || this.identidad.lema();
  }

  /** Descripción de la vista previa, con el mismo criterio. */
  get descripcionVistaPrevia(): string {
    const escrita = this.formPersonalizacion.controls.descripcion.value;
    return escrita?.trim() || this.identidad.descripcion();
  }

  /** Etiqueta del tema elegido, para el resumen de la vista previa. */
  get etiquetaTemaElegido(): string {
    return (
      this.temas.find((tema) => tema.valor === this.temaElegido())?.etiqueta ??
      this.temaElegido()
    );
  }

  mensajePersonalizacion(campo: 'lema' | 'descripcion'): string | null {
    const control = this.formPersonalizacion.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['maxlength']) return 'El texto es demasiado largo';
    return null;
  }

  // --- Banderas de la comunidad: datos ---

  cargarPaises(): void {
    this.cargandoPaises.set(true);
    this.errorPaises.set(null);
    this.cace.listarPaises().subscribe({
      next: (paises) => {
        this.paises.set(paises);
        this.cargandoPaises.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.paises.set([]);
        this.cargandoPaises.set(false);
        this.errorPaises.set(
          extraerMensajeError(err, 'No se pudieron cargar los países'),
        );
      },
    });
  }

  // --- Banderas de la comunidad: alta y edición ---

  /** Deja el formulario listo para añadir un país, ordenado al final. */
  nuevoPais(): void {
    this.paisEnEdicion.set(null);
    this.formPais.reset({
      codigo: '',
      nombre: '',
      // El siguiente número libre: así un país nuevo no se cuela el primero.
      orden: this.siguienteOrden(),
      activo: true,
    });
    this.errorPaises.set(null);
    this.avisoPaises.set(null);
  }

  editarPais(pais: PaisComunidad): void {
    this.paisEnEdicion.set(pais.id);
    this.formPais.reset({
      codigo: pais.codigo,
      nombre: pais.nombre,
      orden: pais.orden,
      activo: pais.activo,
    });
    this.errorPaises.set(null);
    this.avisoPaises.set(null);
  }

  cancelarEdicionPais(): void {
    this.nuevoPais();
  }

  /** Guarda el país del formulario: crea uno nuevo o actualiza el que se edita. */
  guardarPais(): void {
    if (this.cargandoPaises()) return;

    if (this.formPais.invalid) {
      this.formPais.markAllAsTouched();
      return;
    }

    const { codigo, nombre, orden, activo } = this.formPais.getRawValue();
    const id = this.paisEnEdicion();
    const dto = {
      codigo: (codigo ?? '').toUpperCase(),
      nombre: (nombre ?? '').trim(),
      orden,
      activo,
    };

    this.cargandoPaises.set(true);
    this.errorPaises.set(null);
    this.avisoPaises.set(null);

    const peticion = id
      ? this.cace.actualizarPais(id, dto)
      : this.cace.crearPais(dto);

    peticion.subscribe({
      next: (pais) => {
        this.cargandoPaises.set(false);
        this.avisoPaises.set(
          id ? `País ${pais.nombre} actualizado.` : `País ${pais.nombre} añadido a la comunidad.`,
        );
        this.nuevoPais();
        this.cargarPaises();
        // Las banderas de la web salen de aquí: se refresca lo público.
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPaises.set(false);
        this.errorPaises.set(
          extraerMensajeError(err, 'No se pudo guardar el país'),
        );
      },
    });
  }

  /**
   * Activa o desactiva un país de un clic. Desactivar es la forma habitual de
   * retirar un país: desaparece de la web sin perder la fila.
   */
  alternarActivoPais(pais: PaisComunidad): void {
    if (this.cargandoPaises()) return;

    this.cargandoPaises.set(true);
    this.errorPaises.set(null);
    this.avisoPaises.set(null);

    this.cace.actualizarPais(pais.id, { activo: !pais.activo }).subscribe({
      next: (actualizado) => {
        this.cargandoPaises.set(false);
        this.avisoPaises.set(
          actualizado.activo
            ? `${actualizado.nombre} vuelve a la comunidad.`
            : `${actualizado.nombre} deja de aparecer en la web.`,
        );
        this.cargarPaises();
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPaises.set(false);
        this.errorPaises.set(
          extraerMensajeError(err, 'No se pudo cambiar el estado del país'),
        );
      },
    });
  }

  /** Quitar un país es irreversible: se confirma antes de enviarlo. */
  pedirEliminarPais(pais: PaisComunidad): void {
    this.errorPaises.set(null);
    this.avisoPaises.set(null);
    this.paisAEliminar.set(pais);
  }

  cancelarEliminarPais(): void {
    this.paisAEliminar.set(null);
  }

  confirmarEliminarPais(): void {
    const pais = this.paisAEliminar();
    if (!pais || this.cargandoPaises()) return;

    this.cargandoPaises.set(true);
    this.errorPaises.set(null);
    this.avisoPaises.set(null);

    this.cace.eliminarPais(pais.id).subscribe({
      next: (res) => {
        this.cargandoPaises.set(false);
        this.paisAEliminar.set(null);
        this.avisoPaises.set(res.mensaje);
        if (this.paisEnEdicion() === pais.id) this.nuevoPais();
        this.cargarPaises();
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPaises.set(false);
        this.paisAEliminar.set(null);
        this.errorPaises.set(
          extraerMensajeError(err, 'No se pudo quitar el país'),
        );
      },
    });
  }

  /** Siguiente número de orden libre (el último + 1). */
  private siguienteOrden(): number {
    const ordenes = this.paises().map((pais) => pais.orden);
    return ordenes.length === 0 ? 1 : Math.max(...ordenes) + 1;
  }

  mensajePais(campo: 'codigo' | 'nombre' | 'orden'): string | null {
    const control = this.formPais.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['pattern']) return 'Dos letras, por ejemplo PT';
    if (control.errors['minlength']) return 'Escribe el nombre del país';
    if (control.errors['min'] || control.errors['max'])
      return 'El orden va de 0 a 999';
    return null;
  }

  /** Bandera de un país: la arma el código ISO, igual que en docente y agente. */
  banderaUrl(codigo: string): string {
    return `https://flagcdn.com/w40/${codigo.toLowerCase()}.png`;
  }

  // --- Premios: datos ---

  cargarPremios(): void {
    this.cargandoPremios.set(true);
    this.errorPremios.set(null);
    this.cace.listarPremios().subscribe({
      next: (res) => {
        this.premios.set(res.premios);
        this.institucionesOpcion.set(res.instituciones);
        this.cargandoPremios.set(false);
        this.publicarEnCampana();
      },
      error: (err: HttpErrorResponse) => {
        this.premios.set([]);
        this.cargandoPremios.set(false);
        this.errorPremios.set(
          extraerMensajeError(err, 'No se pudieron cargar los premios'),
        );
        this.publicarEnCampana();
      },
    });
  }

  // --- Premios: alta y edición ---

  /** Deja el formulario listo para un premio nuevo. */
  nuevoPremio(): void {
    this.premioEnEdicion.set(null);
    this.formPremio.reset({
      titulo: '',
      descripcion: '',
      anio: new Date().getFullYear(),
      otorgadoA: '',
      institucionId: null,
      orden: this.siguienteOrdenPremio(),
      // Se crea sin publicar: sale al aire solo cuando la presidencia lo decide.
      publicado: false,
    });
    this.errorPremios.set(null);
    this.avisoPremios.set(null);
  }

  editarPremio(premio: Premio): void {
    this.premioEnEdicion.set(premio.id);
    this.formPremio.reset({
      titulo: premio.titulo,
      descripcion: premio.descripcion,
      anio: premio.anio,
      otorgadoA: premio.otorgadoA,
      institucionId: premio.institucionId,
      orden: premio.orden,
      publicado: premio.publicado,
    });
    this.errorPremios.set(null);
    this.avisoPremios.set(null);
  }

  cancelarEdicionPremio(): void {
    this.nuevoPremio();
  }

  guardarPremio(): void {
    if (this.cargandoPremios()) return;

    if (this.formPremio.invalid) {
      this.formPremio.markAllAsTouched();
      return;
    }

    const valores = this.formPremio.getRawValue();
    const id = this.premioEnEdicion();
    const dto = {
      titulo: valores.titulo ?? '',
      descripcion: valores.descripcion ?? '',
      anio: valores.anio ?? new Date().getFullYear(),
      otorgadoA: valores.otorgadoA ?? '',
      institucionId: valores.institucionId,
      orden: valores.orden,
      publicado: valores.publicado,
    };

    this.cargandoPremios.set(true);
    this.errorPremios.set(null);
    this.avisoPremios.set(null);

    const peticion = id
      ? this.cace.actualizarPremio(id, dto)
      : this.cace.crearPremio(dto);

    peticion.subscribe({
      next: (premio) => {
        this.cargandoPremios.set(false);
        this.avisoPremios.set(
          id
            ? `Premio «${premio.titulo}» actualizado.`
            : `Premio «${premio.titulo}» guardado. ${
                premio.publicado
                  ? 'Ya se ve en la sección pública.'
                  : 'Queda como borrador hasta que lo publiques.'
              }`,
        );
        // Si se acaba de crear, se deja abierto para poder subirle la imagen.
        if (!id) this.editarPremio(premio);
        this.cargarPremios();
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPremios.set(false);
        this.errorPremios.set(
          extraerMensajeError(err, 'No se pudo guardar el premio'),
        );
      },
    });
  }

  /** Publicar o retirar de la web de un clic, sin pasar por el formulario. */
  alternarPublicado(premio: Premio): void {
    if (this.cargandoPremios()) return;

    this.cargandoPremios.set(true);
    this.errorPremios.set(null);
    this.avisoPremios.set(null);

    this.cace.actualizarPremio(premio.id, { publicado: !premio.publicado }).subscribe({
      next: (actualizado) => {
        this.cargandoPremios.set(false);
        this.avisoPremios.set(
          actualizado.publicado
            ? `«${actualizado.titulo}» ya está publicado.`
            : `«${actualizado.titulo}» vuelve a ser un borrador.`,
        );
        this.cargarPremios();
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPremios.set(false);
        this.errorPremios.set(
          extraerMensajeError(err, 'No se pudo cambiar la publicación'),
        );
      },
    });
  }

  pedirEliminarPremio(premio: Premio): void {
    this.errorPremios.set(null);
    this.avisoPremios.set(null);
    this.premioAEliminar.set(premio);
  }

  cancelarEliminarPremio(): void {
    this.premioAEliminar.set(null);
  }

  confirmarEliminarPremio(): void {
    const premio = this.premioAEliminar();
    if (!premio || this.cargandoPremios()) return;

    this.cargandoPremios.set(true);
    this.errorPremios.set(null);
    this.avisoPremios.set(null);

    this.cace.eliminarPremio(premio.id).subscribe({
      next: (res) => {
        this.cargandoPremios.set(false);
        this.premioAEliminar.set(null);
        this.avisoPremios.set(res.mensaje);
        if (this.premioEnEdicion() === premio.id) this.nuevoPremio();
        this.cargarPremios();
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPremios.set(false);
        this.premioAEliminar.set(null);
        this.errorPremios.set(
          extraerMensajeError(err, 'No se pudo eliminar el premio'),
        );
      },
    });
  }

  /**
   * Imagen del premio. Solo se puede subir cuando el premio ya existe (necesita
   * su id), así que en la lista de premios guardados es donde está el control.
   */
  async alSeleccionarImagen(premio: Premio, evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      this.errorPremios.set('Elige una imagen (PNG, JPG o WEBP).');
      return;
    }
    if (archivo.size > PESO_MAXIMO_IMAGEN) {
      this.errorPremios.set('La imagen es demasiado grande (máximo 12 MB).');
      return;
    }

    this.subiendoImagen.set(premio.id);
    this.errorPremios.set(null);
    this.avisoPremios.set(null);

    let preparado: File;
    try {
      preparado = await prepararLogo(archivo);
    } catch {
      this.subiendoImagen.set(null);
      this.errorPremios.set('No se pudo leer la imagen. Prueba con otra.');
      return;
    }

    this.cace.subirImagenPremio(premio.id, preparado).subscribe({
      next: (actualizado) => {
        this.subiendoImagen.set(null);
        this.avisoPremios.set(`Imagen de «${actualizado.titulo}» actualizada.`);
        this.cargarPremios();
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoImagen.set(null);
        this.errorPremios.set(
          extraerMensajeError(err, 'No se pudo subir la imagen'),
        );
      },
    });
  }

  quitarImagen(premio: Premio): void {
    if (this.subiendoImagen() !== null) return;

    this.subiendoImagen.set(premio.id);
    this.errorPremios.set(null);
    this.avisoPremios.set(null);

    this.cace.quitarImagenPremio(premio.id).subscribe({
      next: (actualizado) => {
        this.subiendoImagen.set(null);
        this.avisoPremios.set(`Imagen de «${actualizado.titulo}» eliminada.`);
        this.cargarPremios();
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoImagen.set(null);
        this.errorPremios.set(
          extraerMensajeError(err, 'No se pudo quitar la imagen'),
        );
      },
    });
  }

  /** Imagen de un premio lista para un `<img>`. */
  imagenDe(premio: Premio): string | null {
    return urlDeArchivo(premio.imagenUrl);
  }

  private siguienteOrdenPremio(): number {
    const ordenes = this.premios().map((premio) => premio.orden);
    return ordenes.length === 0 ? 1 : Math.max(...ordenes) + 1;
  }

  mensajePremio(
    campo: 'titulo' | 'descripcion' | 'anio' | 'otorgadoA' | 'orden',
  ): string | null {
    const control = this.formPremio.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['minlength']) return 'Escribe al menos 3 caracteres';
    if (control.errors['maxlength']) return 'El texto es demasiado largo';
    if (control.errors['min'] || control.errors['max'])
      return campo === 'anio' ? 'Escribe un año entre 1900 y 2100' : 'El orden va de 0 a 999';
    return null;
  }

  // --- Presentación ---

  etiquetaEstado(estadoCace: string): string {
    switch (estadoCace) {
      case 'PENDIENTE':
        return 'Pendiente';
      case 'APROBADA':
        return 'Aprobada';
      case 'RECHAZADA':
        return 'Rechazada';
      case 'VETADA':
        return 'Vetada';
      default:
        return estadoCace;
    }
  }

  claseEstado(estadoCace: string): string {
    switch (estadoCace) {
      case 'PENDIENTE':
        return 'estado pendiente';
      case 'APROBADA':
        return 'estado aprobada';
      case 'RECHAZADA':
        return 'estado rechazada';
      case 'VETADA':
        return 'estado vetada';
      default:
        return 'estado cancelada';
    }
  }

  fechaRevision(valor: string | null): string {
    return valor ? fechaHoraLarga(valor) : '';
  }

  /**
   * La campana avisa de lo que espera al presidente. Publicar aquí es lo que
   * hacen las pantallas de docente y agente con sus propios pendientes. Los
   * contadores alimentan las insignias del menú lateral.
   */
  private publicarEnCampana(): void {
    const pendientes = this.pendientes().length;
    const borradores = this.borradores();
    const avisos: PendienteUi[] = [];
    if (pendientes > 0) {
      avisos.push({
        titulo: `${pendientes} ${pendientes === 1 ? 'institución' : 'instituciones'} por aprobar`,
        detalle: 'Revísalas y decide si se aprueban, se rechazan o se vetan.',
        ancla: 'instituciones',
        tono: 'aviso',
      });
    }
    if (borradores > 0) {
      avisos.push({
        titulo: `${borradores} ${borradores === 1 ? 'premio' : 'premios'} sin publicar`,
        detalle: 'Los borradores no salen en la web hasta que los publiques.',
        ancla: 'premios',
        tono: 'aviso',
      });
    }
    this.ui.publicarPendientes(avisos);
    this.ui.publicarContadores({ instituciones: pendientes, premios: borradores });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
