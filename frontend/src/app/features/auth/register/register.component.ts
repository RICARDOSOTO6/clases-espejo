import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { InstitucionesService } from '../../../core/services/instituciones.service';
import { InstitucionDirectorio, RegisterDto } from '../../../core/models/auth.models';
import { extraerMensajeError } from '../../../core/utils/http-error.util';
import { urlDeArchivo } from '../../../core/utils/url-archivo.util';
import { CARGOS, PAISES, TIPOS_DOCUMENTO } from '../../../core/constants/catalogos';
import { esTextoValido } from '../../../core/utils/validators';
import { mensajeDeControl } from '../../../core/utils/formulario.util';

/** Campos de la institución: solo se exigen cuando se crea una nueva. */
const CAMPOS_INSTITUCION = [
  'nombreInstitucion',
  'paisCodigo',
  'estado',
  'ciudad',
  'telefono',
  'correoInstitucional',
];

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly instituciones = inject(InstitucionesService);
  private readonly router = inject(Router);

  readonly paises = PAISES;
  readonly tiposDocumento = TIPOS_DOCUMENTO;
  readonly cargos = CARGOS;

  /**
   * Formulario en dos partes: los datos de la persona siempre, y los de la
   * institución **solo si se crea una nueva**. Los campos institucionales se
   * activan y desactivan según el modo, que es lo que hace que `form.invalid`
   * signifique lo correcto en cada momento.
   */
  form = this.fb.group({
    nombres: ['', [Validators.required, esTextoValido()]],
    apellidoPaterno: ['', [Validators.required, esTextoValido()]],
    apellidoMaterno: ['', [Validators.required, esTextoValido()]],
    tipoDocumento: ['DNI', Validators.required],
    dni: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
    aceptaAviso: [false, Validators.requiredTrue],
    nombreInstitucion: [''],
    paisCodigo: [''],
    estado: [''],
    ciudad: [''],
    telefono: [''],
    correoInstitucional: [''],
    cargo: ['', Validators.required],
  });

  error = signal<string | null>(null);
  loading = signal(false);
  showPassword = false;
  prefijoTelefono = signal('');

  // --- Buscar antes de crear ---

  /** Directorio de instituciones que ya existen. */
  readonly directorio = signal<InstitucionDirectorio[]>([]);
  readonly cargandoDirectorio = signal(false);
  readonly errorDirectorio = signal<string | null>(null);
  readonly busqueda = signal('');
  /** Institución elegida de la lista (null = todavía no ha elegido). */
  readonly elegida = signal<InstitucionDirectorio | null>(null);
  /** Verdadero cuando el agente dice que su institución no está en la lista. */
  readonly creandoNueva = signal(false);

  /** Resultados de la búsqueda, ya filtrados por nombre y país. */
  readonly resultados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const lista = this.directorio();
    if (!texto) return lista.slice(0, 30);
    return lista
      .filter((i) => i.nombre.toLowerCase().includes(texto) || i.pais.toLowerCase().includes(texto))
      .slice(0, 30);
  });

  /** Una institución rechazada, vetada o archivada no admite registros nuevos. */
  readonly elegidaBloqueada = computed(() => {
    const estado = this.elegida()?.estadoCace;
    return estado === 'RECHAZADA' || estado === 'VETADA' || estado === 'ARCHIVADA';
  });

  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    this.cargarDirectorio();
  }

  cargarDirectorio(): void {
    this.cargandoDirectorio.set(true);
    this.errorDirectorio.set(null);
    this.instituciones.directorio().subscribe({
      next: (lista) => {
        this.directorio.set(lista);
        this.cargandoDirectorio.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.directorio.set([]);
        this.cargandoDirectorio.set(false);
        this.errorDirectorio.set(
          extraerMensajeError(err, 'No se pudo cargar la lista de instituciones'),
        );
      },
    });
  }

  /** El texto se escribe rápido: se espera un momento antes de buscar. */
  onBusqueda(valor: string): void {
    this.busqueda.set(valor);
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.instituciones.directorio(valor).subscribe({
        next: (lista) => this.directorio.set(lista),
        error: () => {
          /* La lista anterior se queda: buscar no debe romper el formulario. */
        },
      });
    }, 250);
  }

  elegirInstitucion(institucion: InstitucionDirectorio): void {
    this.elegida.set(institucion);
    this.creandoNueva.set(false);
    this.error.set(null);
    this.desactivarDatosDeInstitucion();
  }

  /** «Mi institución no está en la lista»: se piden sus datos. */
  crearInstitucionNueva(): void {
    this.elegida.set(null);
    this.creandoNueva.set(true);
    this.error.set(null);
    this.activarDatosDeInstitucion();
  }

  volverABuscar(): void {
    this.creandoNueva.set(false);
    this.desactivarDatosDeInstitucion();
  }

  logoDe(institucion: InstitucionDirectorio): string | null {
    return urlDeArchivo(institucion.logoUrl);
  }

  etiquetaEstado(estadoCace: string): string {
    switch (estadoCace) {
      case 'APROBADA':
        return 'Aprobada por la CACE';
      case 'PENDIENTE':
        return 'Pendiente de aprobación';
      case 'RECHAZADA':
        return 'Rechazada: no admite registros';
      case 'VETADA':
        return 'Vetada: no admite registros';
      case 'ARCHIVADA':
        return 'Archivada: no admite registros';
      default:
        return estadoCace;
    }
  }

  /** Los campos de la institución solo cuentan cuando se crea una nueva. */
  private activarDatosDeInstitucion(): void {
    this.form.get('nombreInstitucion')?.setValidators([Validators.required, esTextoValido()]);
    this.form.get('paisCodigo')?.setValidators([Validators.required]);
    this.form.get('estado')?.setValidators([Validators.required, esTextoValido()]);
    this.form.get('ciudad')?.setValidators([Validators.required, esTextoValido()]);
    this.form.get('telefono')?.setValidators([Validators.required]);
    this.form.get('correoInstitucional')?.setValidators([Validators.required, Validators.email]);
    this.actualizarValidaciones();
  }

  private desactivarDatosDeInstitucion(): void {
    for (const campo of CAMPOS_INSTITUCION) {
      this.form.get(campo)?.clearValidators();
    }
    this.actualizarValidaciones();
  }

  private actualizarValidaciones(): void {
    for (const campo of CAMPOS_INSTITUCION) {
      this.form.get(campo)?.updateValueAndValidity();
    }
  }

  onPaisChange(): void {
    const codigo = this.form.get('paisCodigo')?.value;
    const pais = PAISES.find((p) => p.codigo === codigo);
    this.prefijoTelefono.set(pais?.prefijo ?? '');
  }

  mensajeDe(campo: string): string | null {
    return mensajeDeControl(this.form, campo, {
      required: 'Este campo es obligatorio',
      email: 'Introduce un correo válido',
      minlength: 'Mínimo 12 caracteres',
      textoInvalido: 'Escribe un valor válido (solo letras, sin secuencias aleatorias)',
    });
  }

  submit(): void {
    if (this.loading()) return;

    // Antes de nada: hay que haber elegido una institución o pedido crearla.
    if (!this.elegida() && !this.creandoNueva()) {
      this.error.set(
        'Busca tu institución en la lista y elígela; si no está, marca «no está, crearla».',
      );
      return;
    }
    if (this.elegidaBloqueada()) {
      this.error.set(
        'Esa institución no admite registros nuevos. Elige otra o ponte en contacto con la CACE.',
      );
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const pais = PAISES.find((p) => p.codigo === v.paisCodigo);
    const elegida = this.elegida();

    const dto: RegisterDto = {
      nombres: v.nombres ?? '',
      apellidoPaterno: v.apellidoPaterno ?? '',
      apellidoMaterno: v.apellidoMaterno ?? '',
      tipoDocumento: v.tipoDocumento ?? 'DNI',
      dni: v.dni ?? '',
      correo: v.correo ?? '',
      password: v.password ?? '',
      aceptaAviso: v.aceptaAviso === true,
      cargo: v.cargo ?? '',
    };

    if (elegida) {
      // Se une a una institución que ya existe: no se reenvían sus datos.
      dto.institucionId = elegida.id;
    } else {
      dto.nombreInstitucion = v.nombreInstitucion ?? '';
      dto.pais = pais?.nombre ?? '';
      dto.codigoPais = v.paisCodigo ?? '';
      dto.estado = v.estado ?? '';
      dto.ciudad = v.ciudad ?? '';
      dto.telefono = `${this.prefijoTelefono()} ${v.telefono ?? ''}`.trim();
      dto.correoInstitucional = v.correoInstitucional ?? '';
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.register(dto).subscribe({
      next: (res) => {
        this.loading.set(false);
        // El aviso del servidor explica si el alta queda pendiente de
        // confirmación o de la aprobación del presidente.
        this.router.navigate(['/login'], {
          queryParams: { registrado: '1', aviso: res.mensaje },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(extraerMensajeError(err, 'Error al enviar la solicitud'));
      },
    });
  }
}
