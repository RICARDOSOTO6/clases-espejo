import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CaceService, DecisionCace, InstitucionCace } from '../../core/services/cace.service';
import { IdentidadCaceService } from '../../core/services/identidad-cace.service';
import { PlantillaCertificadoService } from '../../core/services/plantilla-certificado.service';
import { PendienteUi, UiStateService } from '../../core/services/ui-state.service';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { DisenoCertificadoComponent } from './diseno-certificado/diseno-certificado.component';
import {
  InstitucionOpcion,
  PaisComunidad,
  Premio,
} from '../../core/models/cace-identidad.models';
import {
  HistorialPresidenciaCace,
  InstitucionRechazadaCace,
  MiembroCace,
  SolicitudBorradoCace,
} from '../../core/models/cace-miembros.models';
import {
  BorradorPlantillaCertificado,
  CamposCertificado,
  EstadoPlantillaCertificado,
  PlantillaCertificado,
} from '../../core/models/certificado.models';
import {
  LIENZO_POR_DEFECTO,
} from '../../core/utils/certificado-medidas';
import {
  TEMAS_CACE,
  TIPOS_RECONOCIMIENTO,
  TipoReconocimiento,
  TemaCace,
} from '../../core/constants/cace';
import { extraerMensajeError } from '../../core/utils/http-error.util';
import { fechaHoraLarga } from '../../core/utils/fecha.util';
import { urlDeArchivo } from '../../core/utils/url-archivo.util';
import { prepararLogo } from '../../core/utils/imagen.util';
import { mensajeDeControl } from '../../core/utils/formulario.util';

interface ModuloCace {
  id: string;
  etiqueta: string;
  ancla?: string;
  ruta?: string;
  capacidades?: string[];
}

interface KpiCace {
  etiqueta: string;
  valor: number;
  tono: 'warn' | 'info' | 'success' | 'danger';
}

/** Decisión que exige motivo: el correo al agente lo lleva escrito. */
type DecisionConMotivo = 'rechazar' | 'vetar';

/** Siguiente número de orden libre de una lista (el último + 1). */
function siguienteOrdenDe(items: { orden: number }[]): number {
  const ordenes = items.map((item) => item.orden);
  return ordenes.length === 0 ? 1 : Math.max(...ordenes) + 1;
}

/**
 * Peso máximo de la imagen original antes de prepararla. El navegador la reduce
 * (a 512 px de lado mayor) y el servidor solo admite 2 MB, así que este tope es
 * para avisar antes de subir una foto de móvil de varios megas.
 */
const PESO_MAXIMO_IMAGEN = 12 * 1024 * 1024;

/**
 * Certificado de un premio: el documento que lo acredita. Se admite PDF además
 * de imagen y el tope es el del servidor (8 MB), porque un certificado escaneado
 * pesa más que una foto y aquí no se reduce nada: el documento se guarda tal cual
 * y se descarga con su nombre.
 */
const PESO_MAXIMO_CERTIFICADO = 8 * 1024 * 1024;

/** Tipos de documento que acepta el certificado de un premio. */
const TIPOS_CERTIFICADO = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

/** Normaliza búsquedas para que los acentos no cambien los resultados. */
function normalizarBusqueda(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/**
 * Primera pantalla del presidente de la CACE.
 *
 * Usa el esqueleto `<app-layout>` con el rol de la CACE (`PRESIDENTE_CACE` o
 * `SECRETARIA_CACE`), así que tiene barra superior, campana de pendientes y
 * menú lateral propios. La campana se llena con lo que publica esta pantalla
 * (`publicarEnCampana`), igual que hacen las pantallas de docente y agente.
 *
 * La presidencia y la secretaría comparten pantalla, pero **no** ven lo mismo:
 * al entrar se piden las capacidades (`GET /cace/capacidades`) y con ellas se
 * esconden las secciones y los botones que el rol no puede usar. Antes se
 * adivinaba por el rol y la secretaría se encontraba «Instituciones» para
 * comerse un 403 al abrirla.
 *
 * Aquí está el cambio de contraseña obligatorio del primer acceso, la gestión
 * de instituciones (aprobar, rechazar, vetar y reactivar), las secretarías
 * (alta, activar y desactivar), el borrado con autorización (la secretaría pide
 * y la presidencia resuelve) y la identidad de la CACE: personalización (logo,
 * textos y tema), banderas de la comunidad y premios.
 */
@Component({
  selector: 'app-cace',
  imports: [ReactiveFormsModule, RouterLink, LayoutComponent, DisenoCertificadoComponent],
  templateUrl: './cace.component.html',
  styleUrl: './cace.component.css',
})
export class CaceComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly cace = inject(CaceService);
  /** Identidad pública: la portada, el logo de la barra y el tema aplicado. */
  private readonly identidad = inject(IdentidadCaceService);
  /** Plantilla del certificado (fase 4): la diseña y la firma la presidencia. */
  private readonly plantillaService = inject(PlantillaCertificadoService);
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
   * comparten pantalla; lo que las diferencia son las capacidades, que viajan al
   * esqueleto para que no ofrezca lo que el rol no puede hacer.
   */
  readonly rolCace = computed<'PRESIDENTE_CACE' | 'SECRETARIA_CACE'>(() =>
    this.auth.currentUser()?.rol === 'SECRETARIA_CACE'
      ? 'SECRETARIA_CACE'
      : 'PRESIDENTE_CACE',
  );

  /** ¿Se enseña esta sección en la pantalla actual? */
  mostrarSeccion(
    id:
      | 'instituciones'
      | 'miembros'
      | 'presidencia'
      | 'solicitudes'
      | 'personalizacion'
      | 'comunidad'
      | 'premios'
      | 'certificado',
  ): boolean {
    const solo = this.soloSeccion();
    if (solo) {
      return solo === id;
    }
    // Personalización y Certificado tienen página propia: en el panel general
    // no se repiten (el menú lateral lleva a ellas).
    return id !== 'personalizacion' && id !== 'certificado';
  }

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);

  /**
   * Página dedicada: al entrar por /cace/personalizacion o /cace/certificado
   * se enseña solo esa sección a pantalla completa (la misma lógica y datos,
   * sin mover el estado a otro componente).
   */
  readonly soloSeccion = signal<'personalizacion' | 'certificado' | null>(null);

  /** Navegación compacta de los módulos que este rol puede usar. */
  readonly modulosCace = computed<ModuloCace[]>(() => {
    const modulos: ModuloCace[] = [
      { id: 'resumen', etiqueta: 'Resumen', ancla: 'cabecera' },
      {
        id: 'instituciones',
        etiqueta: 'Instituciones',
        ancla: 'instituciones',
        capacidades: ['aprobarInstituciones'],
      },
      {
        id: 'miembros',
        etiqueta: 'Equipo CACE',
        ancla: 'miembros',
        capacidades: ['gestionarMiembrosCace']
      },
      {
        id: 'presidencia',
        etiqueta: 'Presidencia',
        ancla: 'presidencia',
        capacidades: ['gestionarMiembrosCace']
      },
      {
        id: 'solicitudes',
        etiqueta: 'Solicitudes',
        ancla: 'solicitudes',
      },
      {
        id: 'personalizacion',
        etiqueta: 'Identidad',
        ruta: '/cace/personalizacion',
        capacidades: ['personalizarCace']
      },
      {
        id: 'comunidad',
        etiqueta: 'Comunidad',
        ancla: 'comunidad',
        capacidades: ['personalizarCace']
      },
      {
        id: 'premios',
        etiqueta: 'Premios',
        ancla: 'premios',
        capacidades: ['publicarPremios']
      },
      {
        id: 'certificado',
        etiqueta: 'Certificados',
        ruta: '/cace/certificado',
        capacidades: ['disenarCertificados', 'firmarCertificados']
      },
    ];

    return modulos.filter((modulo) => {
      if (modulo.id === 'solicitudes') {
        return (
          this.puede('solicitarBorradoInstitucion') ||
          this.puede('resolverSolicitudesBorrado')
        );
      }
      return (
        !modulo.capacidades ||
        modulo.capacidades.some((capacidad) => this.puede(capacidad))
      );
    });
  });

  /** Resumen de trabajo visible sin abrir cada módulo. */
  readonly kpisCace = computed<KpiCace[]>(() => {
    const kpis: KpiCace[] = [];

    if (this.puede('aprobarInstituciones')) {
      kpis.push({
        etiqueta: 'Instituciones pendientes',
        valor: this.pendientes().length,
        tono: 'warn',
      });
    }
    if (this.puede('gestionarMiembrosCace')) {
      kpis.push({
        etiqueta: 'Miembros activos',
        valor: this.miembros().filter((miembro) => miembro.activo).length,
        tono: 'info',
      });
    }
    if (
      this.puede('solicitarBorradoInstitucion') ||
      this.puede('resolverSolicitudesBorrado')
    ) {
      kpis.push({
        etiqueta: 'Solicitudes de borrado',
        valor: this.solicitudesPendientes(),
        tono: 'danger',
      });
    }
    if (this.puede('publicarPremios')) {
      kpis.push({
        etiqueta: 'Premios en borrador',
        valor: this.borradores(),
        tono: 'success',
      });
    }

    return kpis;
  });

  // --- Capacidades del rol (fase 6) ---

  /**
   * Lo que puede hacer este usuario, tal cual lo dice el servidor. Es la única
   * fuente de verdad de lo que se enseña: la misma tabla que usa el guardia, así
   * que la interfaz no puede ofrecer algo que la API vaya a rechazar.
   */
  readonly capacidades = signal<string[]>([]);
  readonly cargandoCapacidades = signal(true);
  readonly errorCapacidades = signal<string | null>(null);

  /** Las capacidades en crudo, para el `data-capacidades` del panel. */
  readonly capacidadesTexto = computed(
    () => this.capacidades().join(' ') || 'sin-rol',
  );

  /** ¿Este usuario puede hacer esto? (Igual que el `@Requiere(...)` del servidor.) */
  puede(capacidad: string): boolean {
    return this.capacidades().includes(capacidad);
  }

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

  /** Filtros locales de la bandeja administrativa de instituciones. */
  readonly filtroInstituciones = signal('');
  readonly estadoInstituciones = signal('TODAS');
  readonly institucionesFiltradas = computed(() => {
    const texto = normalizarBusqueda(this.filtroInstituciones());
    const estado = this.estadoInstituciones();

    return this.instituciones().filter((institucion) => {
      const coincideEstado = estado === 'TODAS' || institucion.estadoCace === estado;
      if (!coincideEstado) return false;
      if (!texto) return true;

      const agentes = institucion.agentes
        .map((agente) => `${agente.nombre} ${agente.correo}`)
        .join(' ');
      return normalizarBusqueda(`${institucion.nombre} ${institucion.pais} ${agentes}`).includes(texto);
    });
  });

  form = this.fb.group({
    actual: ['', Validators.required],
    nueva: ['', [Validators.required, Validators.minLength(8)]],
    confirmar: ['', Validators.required],
  });

  /** Motivo del rechazo o del veto que se está escribiendo. */
  readonly motivo = this.fb.control('', Validators.required);

  // --- Miembros de la CACE: las secretarías (solo la presidencia) ---

  readonly miembros = signal<MiembroCace[]>([]);
  readonly cargandoMiembros = signal(false);
  readonly errorMiembros = signal<string | null>(null);
  readonly avisoMiembros = signal<string | null>(null);
  /** Alta en curso (evita el doble envío). */
  readonly creandoMiembro = signal(false);
  /** Miembro cuya activación o desactivación está en curso. */
  readonly miembroEnProceso = signal<number | null>(null);
  /** Secretaría cuya desactivación se está confirmando: pierde el acceso al panel. */
  readonly miembroADesactivar = signal<MiembroCace | null>(null);

  /** Filtros de la lista del equipo CACE. */
  readonly filtroMiembros = signal('');
  readonly estadoMiembros = signal<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('TODOS');
  readonly miembrosFiltrados = computed(() => {
    const texto = normalizarBusqueda(this.filtroMiembros());
    const estado = this.estadoMiembros();

    return this.miembros().filter((miembro) => {
      const coincideEstado =
        estado === 'TODOS' ||
        (estado === 'ACTIVOS' && miembro.activo) ||
        (estado === 'INACTIVOS' && !miembro.activo);
      if (!coincideEstado) return false;
      if (!texto) return true;
      return normalizarBusqueda(
        `${miembro.nombre} ${miembro.correo} ${miembro.etiquetaCargo}`,
      ).includes(texto);
    });
  });

  /**
   * Contraseña provisional que solo llega cuando el correo **no** pudo salir.
   * Se muestra una vez para que la presidencia se la pueda dar a mano.
   */
  readonly passwordDeApoyo = signal<{ correo: string; password: string } | null>(
    null,
  );

  formMiembro = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    nombres: ['', [Validators.required, Validators.minLength(2)]],
    apellidoPaterno: ['', [Validators.required, Validators.minLength(2)]],
    apellidoMaterno: [''],
  });

  // --- Presidencia de la CACE: se transmite, no se desactiva ---

  /**
   * La presidencia es una figura central: no se borra ni se apaga. Lo que
   * existe es **«Cambiar de presidente»**, que transmite el cargo: el entrante
   * pasa a presidente y el saliente queda como **suplente, activo y con las
   * mismas capacidades** (el guardia trata igual a las dos figuras). Cada cambio
   * queda escrito en el historial.
   */
  readonly historialPresidencia = signal<HistorialPresidenciaCace | null>(null);
  readonly cargandoHistorial = signal(false);
  readonly errorPresidencia = signal<string | null>(null);
  readonly avisoPresidencia = signal<string | null>(null);
  /** El historial de cambios se enseña solo cuando se pide. */
  readonly historialAbierto = signal(false);
  /** Cambio de presidencia en curso (evita el doble envío). */
  readonly cambiandoPresidencia = signal(false);
  /** Se está eligiendo al sucesor. */
  readonly pidiendoCambioPresidencia = signal(false);
  /** Cómo se elige al sucesor: alguien que ya está en la CACE o una persona nueva. */
  readonly modoSucesor = signal<'miembro' | 'nuevo'>('miembro');
  /** El cambio está a punto de enviarse: se confirma lo que va a pasar. */
  readonly confirmandoCambioPresidencia = signal(false);

  formPresidente = this.fb.group({
    miembroId: this.fb.control<number | null>(null),
    correo: [''],
    nombres: [''],
    apellidoPaterno: [''],
    apellidoMaterno: [''],
    motivo: [''],
  });

  /** La presidencia en ejercicio, tal como la devuelve la lista de miembros. */
  readonly presidenteActual = computed(
    () => this.miembros().find((m) => m.cargo === 'PRESIDENTE' && m.activo) ?? null,
  );

  /**
   * A quién se le puede dar el cargo: cualquier miembro activo que no sea ya la
   * presidencia (la secretaría o un suplente). Un miembro inactivo no vale:
   * tendría el cargo sin poder entrar a ejercerlo.
   */
  readonly candidatosPresidencia = computed(() =>
    this.miembros().filter((m) => m.activo && m.cargo !== 'PRESIDENTE'),
  );

  /** El sucesor elegido en el desplegable (miembro que ya está en la CACE). */
  readonly sucesorElegido = computed(
    () =>
      this.candidatosPresidencia().find(
        (m) => m.id === this.formPresidente.controls.miembroId.value,
      ) ?? null,
  );

  // --- Solicitudes de borrado de instituciones (fase 6) ---

  readonly solicitudes = signal<SolicitudBorradoCace[]>([]);
  /** Instituciones rechazadas sobre las que se puede pedir el borrado. */
  readonly institucionesRechazadas = signal<InstitucionRechazadaCace[]>([]);
  readonly cargandoSolicitudes = signal(false);
  readonly errorSolicitudes = signal<string | null>(null);
  readonly avisoSolicitudes = signal<string | null>(null);
  /** Cuántas esperan decisión (insignia del menú y de la campana). */
  readonly solicitudesPendientes = signal(0);

  /** Filtros de la bandeja de solicitudes de borrado. */
  readonly filtroSolicitudes = signal('');
  readonly estadoSolicitudes = signal<'TODAS' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'>('TODAS');
  readonly solicitudesFiltradas = computed(() => {
    const texto = normalizarBusqueda(this.filtroSolicitudes());
    const estado = this.estadoSolicitudes();

    return this.solicitudes().filter((solicitud) => {
      const coincideEstado = estado === 'TODAS' || solicitud.estado === estado;
      if (!coincideEstado) return false;
      if (!texto) return true;
      return normalizarBusqueda(
        `${solicitud.institucionNombre ?? 'Institución borrada'} ${solicitud.institucionPais ?? ''} ${solicitud.solicitadaPor} ${solicitud.solicitadaPorCorreo} ${solicitud.motivo}`,
      ).includes(texto);
    });
  });

  /** Institución rechazada cuyo borrado está pidiendo la secretaría. */
  readonly pidiendoSolicitudBorrado = signal<InstitucionRechazadaCace | null>(
    null,
  );
  /** Solicitud que está resolviendo la presidencia, y qué va a hacer. */
  readonly resolviendoSolicitud = signal<{
    solicitud: SolicitudBorradoCace;
    accion: 'aprobar' | 'rechazar';
  } | null>(null);
  /** Solicitud con una petición en curso (evita el doble clic). */
  readonly solicitudEnProceso = signal<number | null>(null);

  /** Motivo con el que la secretaría pide el borrado: es obligatorio. */
  readonly motivoSolicitud = this.fb.control('', Validators.required);
  /** Motivo del rechazo de una solicitud: es obligatorio. */
  readonly motivoRechazo = this.fb.control('', Validators.required);

  // --- Filtros y estado de edición de las bandejas ---

  actualizarFiltroInstituciones(evento: Event): void {
    this.filtroInstituciones.set((evento.target as HTMLInputElement).value);
    this.cerrarEdicionesAlFiltrar();
  }

  actualizarEstadoInstituciones(evento: Event): void {
    this.estadoInstituciones.set((evento.target as HTMLSelectElement).value);
    this.cerrarEdicionesAlFiltrar();
  }

  actualizarFiltroMiembros(evento: Event): void {
    this.filtroMiembros.set((evento.target as HTMLInputElement).value);
    this.cerrarEdicionesAlFiltrar();
  }

  actualizarEstadoMiembros(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const estado: 'TODOS' | 'ACTIVOS' | 'INACTIVOS' =
      valor === 'ACTIVOS' || valor === 'INACTIVOS' ? valor : 'TODOS';
    this.estadoMiembros.set(estado);
    this.cerrarEdicionesAlFiltrar();
  }

  actualizarFiltroSolicitudes(evento: Event): void {
    this.filtroSolicitudes.set((evento.target as HTMLInputElement).value);
    this.cerrarEdicionesAlFiltrar();
  }

  actualizarEstadoSolicitudes(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const estado: 'TODAS' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' =
      valor === 'PENDIENTE' || valor === 'APROBADA' || valor === 'RECHAZADA'
        ? valor
        : 'TODAS';
    this.estadoSolicitudes.set(estado);
    this.cerrarEdicionesAlFiltrar();
  }

  private cerrarEdicionesAlFiltrar(): void {
    this.pidiendoMotivo.set(null);
    this.pidiendoBorrado.set(null);
    this.miembroADesactivar.set(null);
    this.pidiendoSolicitudBorrado.set(null);
    this.resolviendoSolicitud.set(null);
    this.motivo.reset('');
    this.motivoSolicitud.reset('');
    this.motivoRechazo.reset('');
  }

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
  readonly tiposReconocimiento = TIPOS_RECONOCIMIENTO;
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
  /** Premio cuyo certificado se está subiendo o quitando. */
  readonly subiendoCertificado = signal<number | null>(null);

  formPremio = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    tipo: this.fb.nonNullable.control<TipoReconocimiento>('RECONOCIMIENTO'),
    descripcion: ['', Validators.maxLength(1500)],
    anio: this.fb.control<number | null>(new Date().getFullYear(), [
      Validators.required,
      Validators.min(1900),
      Validators.max(2100),
    ]),
    otorgadoA: ['', [Validators.required, Validators.minLength(2)]],
    fuenteNombre: ['', Validators.maxLength(120)],
    fuenteUrl: [
      '',
      [Validators.maxLength(500), Validators.pattern(/^https?:\/\/\S+$/i)],
    ],
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

  // --- Plantilla del certificado ---

  /** Todo lo que devuelve el servidor: catálogo y versiones. */
  readonly plantillaEstado = signal<EstadoPlantillaCertificado | null>(null);
  readonly cargandoPlantilla = signal(false);
  readonly errorPlantilla = signal<string | null>(null);
  readonly avisoPlantilla = signal<string | null>(null);
  readonly guardandoPlantilla = signal(false);
  readonly subiendoFondo = signal(false);
  /** Versión cuyo botón «Activar» está en curso. */
  readonly activandoVersion = signal<number | null>(null);
  /** Versión cuyo borrado está en curso (evita el doble clic). */
  readonly borrandoVersion = signal<number | null>(null);

  /**
   * Lo que se está editando. Es la versión activa (o la de arranque, con
   * `version: 0`) con los retoques del panel encima; guardar crea una versión
   * nueva a partir de esto.
   */
  readonly borrador = signal<BorradorPlantillaCertificado | null>(null);

  /** Los datos con su etiqueta, en el orden del catálogo, para el panel. */
  readonly catalogoCampos = computed(
    () => this.plantillaEstado()?.catalogo ?? [],
  );

  /** Las versiones guardadas, tal cual, para la tabla del panel de diseño. */
  readonly versionesPlantilla = computed(
    () => this.plantillaEstado()?.versiones ?? [],
  );

  /**
   * La explicación del panel (la que antes era un párrafo de arriba), plegada.
   * Nace cerrada: el que ya sabe cómo funciona no la necesita.
   */
  readonly ayudaAbierta = signal(false);

  /** La imagen del diseño de la versión en edición, lista para un `<img>`. */
  readonly fondoPlantilla = computed(() => urlDeArchivo(this.borrador()?.fondoUrl));

  /**
   * Los nombres de la clase con los que se puede probar la vista previa. Hoy
   * llega vacío a propósito: las listas de alumnos las sube cada docente y la
   * presidencia no las ve, así que el panel prueba con un nombre largo de
   * ejemplo. El día que exista una consulta de solo lectura, se rellena aquí y
   * el botón pasa a usar el nombre más largo de verdad.
   */
  readonly nombresDeLaClase = signal<string[]>([]);

  /**
   * Los dos archivos de apoyo, que se sirven desde `backend/plantillas`: la
   * imagen de zonas (la capa que se superpone al diseño) y la guía de diseño en
   * Word. Los dos se descargan, no se muestran.
   */
  readonly urlPlantillaZonas = urlDeArchivo('/plantillas/certificado-zonas.png');
  readonly urlGuiaDiseno = urlDeArchivo('/plantillas/guia-diseno-certificado.docx');

  /** Abre o cierra la explicación del panel (el botón «?» del título). */
  alternarAyuda(): void {
    this.ayudaAbierta.update((abierta) => !abierta);
  }


  ngOnInit(): void {
    const url = this.router.url;
    if (url.startsWith('/cace/personalizacion')) {
      this.soloSeccion.set('personalizacion');
    } else if (url.startsWith('/cace/certificado')) {
      this.soloSeccion.set('certificado');
    }

    // Mientras no cambie la contraseña provisional, el panel no se usa. Las
    // secciones se cargan **después** de saber las capacidades: pedir datos que
    // el rol no puede ver acabaría en 403 (era el fallo de «Instituciones» en la
    // pantalla de la secretaría).
    if (!this.debeCambiarPassword()) {
      this.cargarCapacidades();
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
    return mensajeDeControl(this.form, campo, {
      required: 'Este campo es obligatorio',
      minlength: 'Mínimo 8 caracteres',
    });
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
        // Ya se puede usar el panel: se piden las capacidades y, con ellas, las
        // secciones que le toquen a este rol.
        this.cargarCapacidades();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudo cambiar la contraseña'),
        );
      },
    });
  }

  // --- Capacidades: qué puede hacer este usuario ---

  /**
   * Pide las capacidades del usuario. Es lo primero que hace la pantalla: hasta
   * que no llegan no se pide nada más, para no llenar la consola de 403 ni
   * enseñar secciones que el rol no tiene.
   */
  cargarCapacidades(): void {
    this.cargandoCapacidades.set(true);
    this.errorCapacidades.set(null);
    this.cace.obtenerCapacidades().subscribe({
      next: (res) => {
        this.capacidades.set(res.capacidades ?? []);
        this.cargandoCapacidades.set(false);
        this.cargarSegunCapacidades();
      },
      error: (err: HttpErrorResponse) => {
        this.capacidades.set([]);
        this.cargandoCapacidades.set(false);
        this.errorCapacidades.set(
          extraerMensajeError(err, 'No se pudieron cargar tus permisos'),
        );
      },
    });
  }

  /** Carga solo lo que este rol puede ver. */
  private cargarSegunCapacidades(): void {
    if (this.puede('aprobarInstituciones')) this.cargarInstituciones();
    if (this.puede('gestionarMiembrosCace')) {
      this.cargarMiembros();
      // El historial trae quién preside ahora: es lo que se lee primero en la
      // sección de la presidencia.
      this.cargarHistorialPresidencia();
    }
    if (
      this.puede('solicitarBorradoInstitucion') ||
      this.puede('resolverSolicitudesBorrado')
    ) {
      this.cargarSolicitudes();
    }
    if (this.puede('personalizarCace')) {
      this.cargarIdentidad();
      this.cargarPaises();
    }
    if (this.puede('publicarPremios')) this.cargarPremios();
    if (this.puede('disenarCertificados') || this.puede('firmarCertificados')) {
      this.cargarPlantilla();
    }
    this.publicarEnCampana();
  }

  // --- Miembros de la CACE: datos ---

  cargarMiembros(): void {
    this.cargandoMiembros.set(true);
    this.errorMiembros.set(null);
    this.cace.listarMiembros().subscribe({
      next: (lista) => {
        this.miembros.set(lista);
        this.cargandoMiembros.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.miembros.set([]);
        this.cargandoMiembros.set(false);
        this.errorMiembros.set(
          extraerMensajeError(err, 'No se pudieron cargar los miembros de la CACE'),
        );
      },
    });
  }

  /**
   * Da de alta una secretaría. El servidor crea la cuenta (con contraseña
   * provisional y cambio obligatorio) o, si el correo ya es de un usuario, le
   * añade el cargo sin duplicarlo.
   */
  crearMiembro(): void {
    if (this.creandoMiembro()) return;

    if (this.formMiembro.invalid) {
      this.formMiembro.markAllAsTouched();
      return;
    }

    const { correo, nombres, apellidoPaterno, apellidoMaterno } =
      this.formMiembro.getRawValue();
    this.creandoMiembro.set(true);
    this.errorMiembros.set(null);
    this.avisoMiembros.set(null);
    this.passwordDeApoyo.set(null);

    this.cace
      .crearMiembro({
        correo: (correo ?? '').trim(),
        nombres: (nombres ?? '').trim(),
        apellidoPaterno: (apellidoPaterno ?? '').trim(),
        apellidoMaterno: (apellidoMaterno ?? '').trim(),
      })
      .subscribe({
        next: (res) => {
          this.creandoMiembro.set(false);
          this.avisoMiembros.set(
            `${res.mensaje}${res.correoEnviado ? '' : ` ${res.avisoCorreo ?? ''}`}`,
          );
          if (res.passwordProvisional) {
            this.passwordDeApoyo.set({
              correo: res.miembro.correo,
              password: res.passwordProvisional,
            });
          }
          this.formMiembro.reset({
            correo: '',
            nombres: '',
            apellidoPaterno: '',
            apellidoMaterno: '',
          });
          this.cargarMiembros();
        },
        error: (err: HttpErrorResponse) => {
          this.creandoMiembro.set(false);
          this.errorMiembros.set(
            extraerMensajeError(err, 'No se pudo dar de alta la secretaría'),
          );
        },
      });
  }

  /** Reactiva a un miembro de un clic (volver a dar acceso). */
  activarMiembro(miembro: MiembroCace): void {
    this.cambiarActivoMiembro(miembro, true);
  }

  /** Desactivar deja a la persona sin acceso: se confirma antes. */
  pedirDesactivarMiembro(miembro: MiembroCace): void {
    this.errorMiembros.set(null);
    this.avisoMiembros.set(null);
    this.miembroADesactivar.set(miembro);
  }

  cancelarDesactivarMiembro(): void {
    this.miembroADesactivar.set(null);
  }

  confirmarDesactivarMiembro(): void {
    const miembro = this.miembroADesactivar();
    if (!miembro) return;
    this.miembroADesactivar.set(null);
    this.cambiarActivoMiembro(miembro, false);
  }

  private cambiarActivoMiembro(miembro: MiembroCace, activo: boolean): void {
    if (this.miembroEnProceso() !== null) return;

    this.miembroEnProceso.set(miembro.id);
    this.errorMiembros.set(null);
    this.avisoMiembros.set(null);

    this.cace.cambiarActivoMiembro(miembro.id, activo).subscribe({
      next: (res) => {
        this.miembroEnProceso.set(null);
        this.avisoMiembros.set(res.mensaje);
        this.cargarMiembros();
      },
      error: (err: HttpErrorResponse) => {
        this.miembroEnProceso.set(null);
        // El servidor explica por qué no se puede (última presidencia activa, o
        // que nadie se desactive a sí mismo).
        this.errorMiembros.set(
          extraerMensajeError(err, 'No se pudo cambiar el acceso del miembro'),
        );
      },
    });
  }

  /** Valida un campo del alta de secretaría, con el mismo estilo que el resto. */
  mensajeMiembro(
    campo: 'correo' | 'nombres' | 'apellidoPaterno',
  ): string | null {
    return mensajeDeControl(this.formMiembro, campo, {
      required: 'Este campo es obligatorio',
      email: 'Escribe un correo válido, por ejemplo persona@universidad.edu',
      minlength: 'Escribe al menos 2 caracteres',
    });
  }

  // --- Presidencia: elegir al sucesor y transmitir ---

  /** Abre el cambio de presidencia: se empieza eligiendo a un miembro de la CACE. */
  abrirCambioPresidencia(): void {
    this.formPresidente.reset({
      miembroId: this.candidatosPresidencia()[0]?.id ?? null,
      correo: '',
      nombres: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      motivo: '',
    });
    this.modoSucesor.set('miembro');
    this.intentoPresidencia.set(false);
    this.confirmandoCambioPresidencia.set(false);
    this.errorPresidencia.set(null);
    this.avisoPresidencia.set(null);
    this.passwordDeApoyoPresidencia.set(null);
    this.pidiendoCambioPresidencia.set(true);
    // Los candidatos salen de la lista de miembros: si aún no está, se pide.
    if (this.miembros().length === 0) this.cargarMiembros();
  }

  cerrarCambioPresidencia(): void {
    this.pidiendoCambioPresidencia.set(false);
    this.confirmandoCambioPresidencia.set(false);
    this.intentoPresidencia.set(false);
  }

  /** Cambia entre elegir a un miembro que ya está y traer a una persona nueva. */
  elegirModoSucesor(modo: 'miembro' | 'nuevo'): void {
    this.modoSucesor.set(modo);
    this.confirmandoCambioPresidencia.set(false);
    this.errorPresidencia.set(null);
    if (modo === 'miembro' && this.formPresidente.controls.miembroId.value === null) {
      this.formPresidente.controls.miembroId.setValue(
        this.candidatosPresidencia()[0]?.id ?? null,
      );
    }
  }

  /** Se intentó confirmar el cambio: a partir de aquí se enseñan los campos que faltan. */
  private readonly intentoPresidencia = signal(false);

  /**
   * Valida un campo del alta de la persona nueva, con el estilo del resto.
   *
   * No usa `mensajeDeControl` a propósito: aquí el aviso de campo vacío sale al
   * intentar enviar (`intentoPresidencia`), no al tocar el campo.
   */
  mensajePresidente(
    campo: 'correo' | 'nombres' | 'apellidoPaterno',
  ): string | null {
    if (this.modoSucesor() !== 'nuevo') return null;
    const control = this.formPresidente.get(campo);
    const valor = String(control?.value ?? '').trim();
    if (!valor) {
      return this.intentoPresidencia() ? 'Este campo es obligatorio' : null;
    }
    if (control?.errors?.['email']) {
      return 'Escribe un correo válido, por ejemplo persona@universidad.edu';
    }
    if (control?.errors?.['minlength']) return 'Escribe al menos 2 caracteres';
    return null;
  }

  /** ¿Está elegido el sucesor? (Cada modo tiene sus datos obligatorios.) */
  private sucesorValido(): boolean {
    if (this.modoSucesor() === 'miembro') {
      return this.formPresidente.controls.miembroId.value !== null;
    }
    const { correo, nombres, apellidoPaterno } = this.formPresidente.getRawValue();
    return (
      !!correo?.trim() && !!nombres?.trim() && !!apellidoPaterno?.trim()
    );
  }

  /**
   * Lo que va a pasar, escrito antes de confirmar. Es el texto que evita el
   * malentendido de siempre: quien deja el cargo **no se va**, queda como
   * suplente activo con las mismas capacidades; y quien entra, si era
   * secretaría, deja de serlo (el cargo manda).
   */
  readonly textoConfirmacionPresidencia = computed<string>(() => {
    const sucesor = this.sucesorElegido();
    const valores = this.formPresidente.getRawValue();
    const quienEntra = sucesor
      ? sucesor.nombre
      : `${(valores.nombres ?? '').trim()} ${(valores.apellidoPaterno ?? '').trim()}`.trim() ||
        'la persona nueva';
    const presidente = this.presidenteActual();
    const sale = presidente ? presidente.nombre : 'la presidencia actual';

    const partes: string[] = [
      `${quienEntra} pasa a ser PRESIDENTE de la CACE y ${sale} queda como SUPLENTE.`,
      `${sale} sigue activo y conserva las capacidades: no pierde el acceso al panel y no se borra nada.`,
    ];
    if (sucesor && sucesor.cargo === 'SECRETARIA') {
      partes.push(
        `${quienEntra} es secretaría: al recibir la presidencia deja de ser secretaría (el cargo manda).`,
      );
    }
    if (!sucesor) {
      partes.push(
        'Se crea su cuenta con una contraseña provisional y el sistema le pedirá cambiarla al entrar.',
      );
    }
    partes.push('El cambio queda registrado en el historial y se avisa por correo a los dos.');

    return partes.join(' ');
  });

  /** Pide la confirmación: el cargo cambia de manos y conviene leerlo antes. */
  pedirConfirmarCambioPresidencia(): void {
    this.intentoPresidencia.set(true);
    if (!this.sucesorValido()) {
      this.errorPresidencia.set(
        this.modoSucesor() === 'miembro'
          ? 'Elige a quién le vas a transmitir la presidencia. Solo valen miembros activos que no sean ya la presidencia (una secretaría o un suplente).'
          : 'Para traer a una persona nueva hacen falta el correo, el nombre y el apellido paterno.',
      );
      return;
    }
    this.errorPresidencia.set(null);
    this.confirmandoCambioPresidencia.set(true);
  }

  cancelarConfirmarCambioPresidencia(): void {
    this.confirmandoCambioPresidencia.set(false);
  }

  /** Transmite la presidencia. Lo hace todo el servidor, en una transacción. */
  confirmarCambioPresidencia(): void {
    if (this.cambiandoPresidencia() || !this.sucesorValido()) return;

    const { miembroId, correo, nombres, apellidoPaterno, apellidoMaterno, motivo } =
      this.formPresidente.getRawValue();
    const dto =
      this.modoSucesor() === 'miembro'
        ? { miembroId: miembroId ?? undefined, motivo: (motivo ?? '').trim() }
        : {
            correo: (correo ?? '').trim(),
            nombres: (nombres ?? '').trim(),
            apellidoPaterno: (apellidoPaterno ?? '').trim(),
            apellidoMaterno: (apellidoMaterno ?? '').trim(),
            motivo: (motivo ?? '').trim(),
          };

    this.cambiandoPresidencia.set(true);
    this.errorPresidencia.set(null);
    this.avisoPresidencia.set(null);
    this.passwordDeApoyoPresidencia.set(null);

    this.cace.cambiarPresidente(dto).subscribe({
      next: (res) => {
        this.cambiandoPresidencia.set(false);
        this.confirmandoCambioPresidencia.set(false);
        this.pidiendoCambioPresidencia.set(false);
        this.avisoPresidencia.set(
          `${res.mensaje}${res.correoEnviado ? '' : ` ${res.avisoCorreo ?? ''}`}`,
        );
        if (res.passwordProvisional) {
          this.passwordDeApoyoPresidencia.set({
            correo: res.entrante.correo,
            password: res.passwordProvisional,
          });
        }
        // La lista de miembros cambia (los dos cargos) y el historial crece.
        this.cargarMiembros();
        this.cargarHistorialPresidencia();
      },
      error: (err: HttpErrorResponse) => {
        this.cambiandoPresidencia.set(false);
        this.errorPresidencia.set(
          extraerMensajeError(err, 'No se pudo cambiar la presidencia'),
        );
      },
    });
  }

  /** Contraseña provisional del sucesor cuando el correo no pudo salir. */
  readonly passwordDeApoyoPresidencia = signal<{
    correo: string;
    password: string;
  } | null>(null);

  // --- Presidencia: el historial ---

  /** Abre o cierra el historial (se pide al abrirlo la primera vez). */
  alternarHistorialPresidencia(): void {
    const abierto = !this.historialAbierto();
    this.historialAbierto.set(abierto);
    if (abierto) this.cargarHistorialPresidencia();
  }

  cargarHistorialPresidencia(): void {
    this.cargandoHistorial.set(true);
    this.errorPresidencia.set(null);
    this.cace.historialPresidencia().subscribe({
      next: (historial) => {
        this.historialPresidencia.set(historial);
        this.cargandoHistorial.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoHistorial.set(false);
        this.errorPresidencia.set(
          extraerMensajeError(err, 'No se pudo cargar el historial de la presidencia'),
        );
      },
    });
  }

  // --- Solicitudes de borrado: datos ---
  cargarSolicitudes(): void {
    this.cargandoSolicitudes.set(true);
    this.errorSolicitudes.set(null);
    this.cace.listarSolicitudesBorrado().subscribe({
      next: (res) => {
        this.solicitudes.set(res.solicitudes);
        this.institucionesRechazadas.set(res.institucionesRechazadas);
        this.solicitudesPendientes.set(res.pendientes);
        this.cargandoSolicitudes.set(false);
        this.publicarEnCampana();
      },
      error: (err: HttpErrorResponse) => {
        this.solicitudes.set([]);
        this.solicitudesPendientes.set(0);
        this.cargandoSolicitudes.set(false);
        this.errorSolicitudes.set(
          extraerMensajeError(err, 'No se pudieron cargar las solicitudes de borrado'),
        );
        this.publicarEnCampana();
      },
    });
  }

  // --- Solicitudes de borrado: la secretaría pide ---

  /** El motivo es obligatorio: el presidente decide sobre él. */
  pedirSolicitudBorrado(institucion: InstitucionRechazadaCace): void {
    this.motivoSolicitud.reset('');
    this.errorSolicitudes.set(null);
    this.avisoSolicitudes.set(null);
    this.pidiendoSolicitudBorrado.set(institucion);
  }

  cancelarSolicitudBorrado(): void {
    this.pidiendoSolicitudBorrado.set(null);
    this.motivoSolicitud.reset('');
  }

  confirmarSolicitudBorrado(): void {
    const institucion = this.pidiendoSolicitudBorrado();
    if (!institucion || this.solicitudEnProceso() !== null) return;

    const motivo = (this.motivoSolicitud.value ?? '').trim();
    if (!motivo) {
      this.motivoSolicitud.markAsTouched();
      return;
    }

    this.solicitudEnProceso.set(institucion.id);
    this.errorSolicitudes.set(null);
    this.avisoSolicitudes.set(null);

    this.cace.pedirBorradoInstitucion(institucion.id, motivo).subscribe({
      next: (res) => {
        this.solicitudEnProceso.set(null);
        this.pidiendoSolicitudBorrado.set(null);
        this.motivoSolicitud.reset('');
        this.avisoSolicitudes.set(res.mensaje);
        this.cargarSolicitudes();
      },
      error: (err: HttpErrorResponse) => {
        this.solicitudEnProceso.set(null);
        this.errorSolicitudes.set(
          extraerMensajeError(err, 'No se pudo enviar la solicitud de borrado'),
        );
      },
    });
  }

  // --- Solicitudes de borrado: la presidencia resuelve ---

  /** Aprobar ejecuta el borrado: se confirma antes de enviarlo. */
  pedirAprobarSolicitud(solicitud: SolicitudBorradoCace): void {
    this.errorSolicitudes.set(null);
    this.avisoSolicitudes.set(null);
    this.resolviendoSolicitud.set({ solicitud, accion: 'aprobar' });
  }

  /** Rechazar exige motivo: la secretaría tiene que saber por qué. */
  pedirRechazarSolicitud(solicitud: SolicitudBorradoCace): void {
    this.motivoRechazo.reset('');
    this.errorSolicitudes.set(null);
    this.avisoSolicitudes.set(null);
    this.resolviendoSolicitud.set({ solicitud, accion: 'rechazar' });
  }

  cancelarResolucionSolicitud(): void {
    this.resolviendoSolicitud.set(null);
    this.motivoRechazo.reset('');
  }

  confirmarResolucionSolicitud(): void {
    const pendiente = this.resolviendoSolicitud();
    if (!pendiente || this.solicitudEnProceso() !== null) return;

    const aprobar = pendiente.accion === 'aprobar';
    const motivo = (this.motivoRechazo.value ?? '').trim();
    if (!aprobar && !motivo) {
      this.motivoRechazo.markAsTouched();
      return;
    }

    this.solicitudEnProceso.set(pendiente.solicitud.id);
    this.errorSolicitudes.set(null);
    this.avisoSolicitudes.set(null);

    this.cace
      .resolverSolicitudBorrado(
        pendiente.solicitud.id,
        aprobar,
        aprobar ? undefined : motivo,
      )
      .subscribe({
        next: (res) => {
          this.solicitudEnProceso.set(null);
          this.resolviendoSolicitud.set(null);
          this.motivoRechazo.reset('');
          this.avisoSolicitudes.set(res.mensaje);
          // Al aprobar, la institución desaparece: se recargan las dos listas.
          this.cargarSolicitudes();
          if (this.puede('aprobarInstituciones')) this.cargarInstituciones();
        },
        error: (err: HttpErrorResponse) => {
          this.solicitudEnProceso.set(null);
          this.resolviendoSolicitud.set(null);
          // El servidor explica qué lo impide (por ejemplo, que la institución
          // tiene historia). La solicitud sigue pendiente.
          this.errorSolicitudes.set(
            extraerMensajeError(err, 'No se pudo resolver la solicitud'),
          );
          this.cargarSolicitudes();
        },
      });
  }

  /** Cuántas solicitudes hay pendientes (para la insignia de la sección). */
  readonly solicitudesPorResolver = computed(
    () => this.solicitudes().filter((s) => s.estado === 'PENDIENTE').length,
  );

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
    return mensajeDeControl(this.formPersonalizacion, campo, {
      maxlength: 'El texto es demasiado largo',
    });
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
    return siguienteOrdenDe(this.paises());
  }

  mensajePais(campo: 'codigo' | 'nombre' | 'orden'): string | null {
    return mensajeDeControl(this.formPais, campo, {
      required: 'Este campo es obligatorio',
      pattern: 'Dos letras, por ejemplo PT',
      minlength: 'Escribe el nombre del país',
      min: 'El orden va de 0 a 999',
      max: 'El orden va de 0 a 999',
    });
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
      tipo: 'RECONOCIMIENTO',
      descripcion: '',
      anio: new Date().getFullYear(),
      otorgadoA: '',
      fuenteNombre: '',
      fuenteUrl: '',
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
      tipo: premio.tipo,
      descripcion: premio.descripcion,
      anio: premio.anio,
      otorgadoA: premio.otorgadoA,
      fuenteNombre: premio.fuenteNombre,
      fuenteUrl: premio.fuenteUrl ?? '',
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
      tipo: valores.tipo,
      descripcion: valores.descripcion ?? '',
      anio: valores.anio ?? new Date().getFullYear(),
      otorgadoA: valores.otorgadoA ?? '',
      fuenteNombre: valores.fuenteNombre ?? '',
      fuenteUrl: valores.fuenteUrl?.trim() || null,
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

  etiquetaTipo(tipo: TipoReconocimiento): string {
    return (
      this.tiposReconocimiento.find((opcion) => opcion.valor === tipo)?.etiqueta ??
      'Reconocimiento'
    );
  }

  /** Imagen de un premio lista para un `<img>`. */
  imagenDe(premio: Premio): string | null {
    return urlDeArchivo(premio.imagenUrl);
  }

  // --- Certificado del premio ---

  /**
   * Certificado opcional del premio: la evidencia documental del reconocimiento.
   * Se sube tal cual (sin reducir), porque un certificado escaneado en PDF tiene
   * que llegar legible. El servidor comprueba el contenido real del archivo, así
   * que aquí solo se avisa antes de gastar la subida.
   */
  alSeleccionarCertificado(premio: Premio, evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;

    if (!TIPOS_CERTIFICADO.includes(archivo.type)) {
      this.errorPremios.set('Elige un certificado en PDF, PNG, JPG o WEBP.');
      return;
    }
    if (archivo.size > PESO_MAXIMO_CERTIFICADO) {
      this.errorPremios.set('El certificado es demasiado grande (máximo 8 MB).');
      return;
    }

    this.subiendoCertificado.set(premio.id);
    this.errorPremios.set(null);
    this.avisoPremios.set(null);

    this.cace.subirCertificadoPremio(premio.id, archivo).subscribe({
      next: (actualizado) => {
        this.subiendoCertificado.set(null);
        this.avisoPremios.set(
          `Certificado de «${actualizado.titulo}» guardado. ${
            actualizado.publicado
              ? 'Ya se puede ver y descargar.'
              : 'Se podrá descargar cuando publiques el premio.'
          }`,
        );
        this.cargarPremios();
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoCertificado.set(null);
        this.errorPremios.set(
          extraerMensajeError(err, 'No se pudo subir el certificado'),
        );
      },
    });
  }

  quitarCertificado(premio: Premio): void {
    if (this.subiendoCertificado() !== null) return;

    this.subiendoCertificado.set(premio.id);
    this.errorPremios.set(null);
    this.avisoPremios.set(null);

    this.cace.quitarCertificadoPremio(premio.id).subscribe({
      next: (actualizado) => {
        this.subiendoCertificado.set(null);
        this.avisoPremios.set(
          `Certificado de «${actualizado.titulo}» eliminado.`,
        );
        this.cargarPremios();
        this.recargarIdentidadPublica();
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoCertificado.set(null);
        this.errorPremios.set(
          extraerMensajeError(err, 'No se pudo quitar el certificado'),
        );
      },
    });
  }

  /** Certificado listo para abrir o descargar, si el premio lo tiene. */
  certificadoDe(premio: Premio): string | null {
    return urlDeArchivo(premio.certificadoUrl);
  }

  private siguienteOrdenPremio(): number {
    return siguienteOrdenDe(this.premios());
  }

  mensajePremio(
    campo:
      | 'titulo'
      | 'descripcion'
      | 'anio'
      | 'otorgadoA'
      | 'orden'
      | 'fuenteUrl',
  ): string | null {
    const textoRango =
      campo === 'anio'
        ? 'Escribe un año entre 1900 y 2100'
        : campo === 'orden'
          ? 'El orden va de 0 a 999'
          : 'Escribe una URL que empiece por http:// o https://';
    return mensajeDeControl(this.formPremio, campo, {
      required: 'Este campo es obligatorio',
      minlength: 'Escribe al menos 3 caracteres',
      maxlength: 'El texto es demasiado largo',
      min: textoRango,
      max: textoRango,
      pattern: textoRango,
    });
  }

  // --- Plantilla del certificado: datos ---

  /** Trae el catálogo, las versiones y la activa, y la pone en el formulario. */
  cargarPlantilla(): void {
    this.cargandoPlantilla.set(true);
    this.errorPlantilla.set(null);
    this.plantillaService.obtener().subscribe({
      next: (estado) => {
        this.plantillaEstado.set(estado);
        this.cargandoPlantilla.set(false);
        // Se abre siempre la versión activa; si todavía no hay ninguna, la
        // plantilla de arranque que propone el servidor.
        this.usarPlantilla(estado.activa ?? { ...estado.porDefecto, id: 0, version: 0, activa: false });
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPlantilla.set(false);
        this.errorPlantilla.set(
          extraerMensajeError(err, 'No se pudo cargar la plantilla del certificado'),
        );
      },
    });
  }

  /** Carga una versión (o la de arranque) en el panel, sin guardar nada. */
  usarPlantilla(plantilla: {
    id?: number | null;
    version: number;
    activa?: boolean;
    fondoUrl: string | null;
    anchoPx: number;
    altoPx: number;
    campos: CamposCertificado;
  }): void {
    this.borrador.set({
      id: plantilla.id ?? null,
      version: plantilla.version,
      activa: plantilla.activa ?? false,
      fondoUrl: plantilla.fondoUrl,
      anchoPx: plantilla.anchoPx,
      altoPx: plantilla.altoPx,
      campos: copiaDeCampos(plantilla.campos),
    });
    this.errorPlantilla.set(null);
    this.avisoPlantilla.set(null);
  }

  /** Carga una versión concreta de la lista de versiones en el panel. */
  verVersion(plantilla: PlantillaCertificado): void {
    this.usarPlantilla(plantilla);
    this.avisoPlantilla.set(
      `Estás viendo la versión ${plantilla.version}. Guardar creará una versión nueva con estos datos.`,
    );
  }

  /**
   * Vuelve a los tres huecos que manda la guía de diseño.
   *
   * Los números de la guía están medidos sobre el A4 de 3508 × 2480 px; si la
   * plantilla tiene otro lienzo (una versión vieja, o una imagen de otra
   * resolución), se **escalan** a su tamaño en vez de recortarse. La imagen del
   * diseño y el tamaño del papel no se tocan: lo que se restaura es dónde va
   * cada hueco.
   */
  restablecerPlantilla(): void {
    const porDefecto = this.plantillaEstado()?.porDefecto;
    const actual = this.borrador();
    if (!porDefecto || !actual) return;

    const escalaX = actual.anchoPx / LIENZO_POR_DEFECTO.anchoPx;
    const escalaY = actual.altoPx / LIENZO_POR_DEFECTO.altoPx;
    const campos = {} as CamposCertificado;
    for (const clave of Object.keys(porDefecto.campos) as (keyof CamposCertificado)[]) {
      const guia = porDefecto.campos[clave];
      campos[clave] = {
        ...guia,
        x: Math.round(guia.x * escalaX),
        y: Math.round(guia.y * escalaY),
        ancho: Math.round(guia.ancho * escalaX),
        alto: Math.round(guia.alto * escalaY),
      };
    }

    this.usarPlantilla({
      id: actual.id,
      version: actual.version,
      activa: actual.activa,
      fondoUrl: actual.fondoUrl,
      anchoPx: actual.anchoPx,
      altoPx: actual.altoPx,
      campos,
    });
    this.avisoPlantilla.set(
      'Huecos restaurados a la colocación de la guía de diseño. Guardar creará una versión nueva.',
    );
  }

  // --- Plantilla del certificado: edición ---

  /**
   * Aplica al borrador lo que llega del panel de diseño. El panel no toca la
   * plantilla: avisa de lo que cambió y aquí se guarda en el borrador, que es
   * el único sitio del que sale lo que se manda al servidor.
   */
  aplicarCambio(cambio: Partial<BorradorPlantillaCertificado>): void {
    this.borrador.update((b) => (b ? { ...b, ...cambio } : b));
  }

  // --- Plantilla del certificado: guardado ---

  /** Guarda los cambios como versión nueva (el servidor la deja activa). */
  guardarPlantilla(): void {
    const borrador = this.borrador();
    if (!borrador || this.guardandoPlantilla()) return;

    this.guardandoPlantilla.set(true);
    this.errorPlantilla.set(null);
    this.avisoPlantilla.set(null);
    this.plantillaService
      .guardar({
        campos: borrador.campos,
      })
      .subscribe({
        next: (respuesta) => {
          this.guardandoPlantilla.set(false);
          this.avisoPlantilla.set(respuesta.mensaje);
          this.cargarPlantilla();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoPlantilla.set(false);
          this.errorPlantilla.set(
            extraerMensajeError(err, 'No se pudo guardar la plantilla'),
          );
        },
      });
  }

  /**
   * Sube el fondo. El servidor crea con él una versión nueva (así el fondo de
   * una versión no cambia nunca) y la devuelve ya activa. El archivo lo elige el
   * panel de diseño, que es quien tiene el campo de subida; aquí solo se manda.
   */
  alSeleccionarFondo(archivo: File): void {
    if (archivo.size > PESO_MAXIMO_IMAGEN) {
      this.errorPlantilla.set(
        'La imagen pesa demasiado (máximo 12 MB). Reduce su tamaño y vuelve a intentarlo.',
      );
      return;
    }

    this.subiendoFondo.set(true);
    this.errorPlantilla.set(null);
    this.avisoPlantilla.set(null);
    this.plantillaService.subirFondo(archivo).subscribe({
      next: (respuesta) => {
        this.subiendoFondo.set(false);
        this.avisoPlantilla.set(`${respuesta.mensaje} Fondo actualizado.`);
        this.cargarPlantilla();
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoFondo.set(false);
        this.errorPlantilla.set(
          extraerMensajeError(err, 'No se pudo subir el fondo'),
        );
      },
    });
  }

  /** Deja activa una versión anterior (la emisión nueva usará esa). */
  activarVersion(plantilla: PlantillaCertificado): void {
    if (this.activandoVersion() !== null) return;
    this.activandoVersion.set(plantilla.id);
    this.errorPlantilla.set(null);
    this.avisoPlantilla.set(null);
    this.plantillaService.activar(plantilla.id).subscribe({
      next: (respuesta) => {
        this.activandoVersion.set(null);
        this.avisoPlantilla.set(respuesta.mensaje);
        this.cargarPlantilla();
      },
      error: (err: HttpErrorResponse) => {
        this.activandoVersion.set(null);
        this.errorPlantilla.set(
          extraerMensajeError(err, 'No se pudo activar esa versión'),
        );
      },
    });
  }

  /**
   * Borra una versión suelta de la plantilla (ya confirmada en la tabla). El
   * servidor se niega si es la activa o si algún certificado se emitió con ella,
   * y lo explica; aquí solo se enseña lo que responde.
   */
  borrarVersion(plantilla: PlantillaCertificado): void {
    if (this.borrandoVersion() !== null) return;
    this.borrandoVersion.set(plantilla.id);
    this.errorPlantilla.set(null);
    this.avisoPlantilla.set(null);
    this.plantillaService.eliminar(plantilla.id).subscribe({
      next: (respuesta) => {
        this.borrandoVersion.set(null);
        this.avisoPlantilla.set(respuesta.mensaje);
        // Se relee todo: la lista de versiones y el panel, que podía estar
        // enseñando justo la versión que se acaba de borrar.
        this.cargarPlantilla();
      },
      error: (err: HttpErrorResponse) => {
        this.borrandoVersion.set(null);
        this.errorPlantilla.set(
          extraerMensajeError(err, 'No se pudo borrar esa versión'),
        );
      },
    });
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

  /** Estado de una solicitud de borrado, en español. */
  etiquetaEstadoSolicitud(estado: string): string {
    switch (estado) {
      case 'PENDIENTE':
        return 'Pendiente de autorización';
      case 'APROBADA':
        return 'Autorizada y borrada';
      case 'RECHAZADA':
        return 'Rechazada';
      default:
        return estado;
    }
  }

  claseEstadoSolicitud(estado: string): string {
    switch (estado) {
      case 'PENDIENTE':
        return 'estado pendiente';
      case 'APROBADA':
        return 'estado aprobada';
      case 'RECHAZADA':
        return 'estado rechazada';
      default:
        return 'estado cancelada';
    }
  }

  /**
   * La campana avisa de lo que espera al presidente. Publicar aquí es lo que
   * hacen las pantallas de docente y agente con sus propios pendientes. Los
   * contadores alimentan las insignias del menú lateral.
   */
  private publicarEnCampana(): void {
    const pendientes = this.pendientes().length;
    const borradores = this.borradores();
    const solicitudes = this.solicitudesPorResolver();
    const avisos: PendienteUi[] = [];
    if (pendientes > 0) {
      avisos.push({
        titulo: `${pendientes} ${pendientes === 1 ? 'institución' : 'instituciones'} por aprobar`,
        detalle: 'Revísalas y decide si se aprueban, se rechazan o se vetan.',
        ancla: 'instituciones',
        tono: 'aviso',
      });
    }
    if (solicitudes > 0) {
      avisos.push({
        titulo:
          this.puede('resolverSolicitudesBorrado')
            ? `${solicitudes} ${solicitudes === 1 ? 'solicitud' : 'solicitudes'} de borrado por resolver`
            : `${solicitudes} ${solicitudes === 1 ? 'solicitud' : 'solicitudes'} de borrado esperando al presidente`,
        detalle: this.puede('resolverSolicitudesBorrado')
          ? 'Al aprobarlas se borra la institución; al rechazarlas queda el motivo.'
          : 'La presidencia tiene que autorizar el borrado antes de que se haga.',
        ancla: 'solicitudes',
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
    this.ui.publicarContadores({
      instituciones: pendientes,
      premios: borradores,
      solicitudesBorrado: solicitudes,
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

/**
 * Copia de los tres huecos, para no compartir referencias con lo que devolvió
 * el servidor: el borrador se edita a mano y no debe tocar la lista de
 * versiones que se está enseñando al lado.
 */
function copiaDeCampos(campos: CamposCertificado): CamposCertificado {
  const copia = {} as CamposCertificado;
  for (const clave of Object.keys(campos) as (keyof CamposCertificado)[]) {
    copia[clave] = { ...campos[clave] };
  }
  return copia;
}
