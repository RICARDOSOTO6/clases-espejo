import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IdentidadCaceService } from '../../core/services/identidad-cace.service';
import { VerificacionService } from '../../core/services/verificacion.service';
import { VerificacionCertificado } from '../../core/models/certificado.models';
import { fechaHoraLarga, fechaLarga } from '../../core/utils/fecha.util';
import { extraerMensajeError } from '../../core/utils/http-error.util';

/**
 * Página pública de verificación de un certificado: `/verificar/:folio?c=…`.
 *
 * Es la que abre el **QR impreso** en el certificado, y por eso vive **fuera del
 * esqueleto con menú y sin sesión**: quien la abre es un alumno, un empleador o
 * cualquiera que tenga el papel en la mano, no un usuario de la plataforma. Lleva
 * la identidad de la CACE (logo, lema) para que se vea que es la página oficial y
 * no una imitación.
 *
 * Lo que enseña depende del estado que devuelve el servidor:
 *
 * - `VALIDO`: el nombre del alumno, el título de la clase, las dos instituciones,
 *   las fechas, cuándo se emitió y el folio.
 * - `ANULADO`: lo mismo, pero encabezado por un aviso claro y con el motivo. Un
 *   certificado anulado no puede parecer válido: es justo lo que se comprueba.
 * - `NO_ENCONTRADO`: el folio no existe.
 * - `INVALIDO`: el enlace no trae el código del QR o trae uno que no es. **No se
 *   enseña ningún dato del alumno**: el folio es consecutivo y se adivina, así que
 *   sin el código la página no confirma ni siquiera que el certificado exista.
 *
 * Los estados van también en el atributo `data-verificacion` y cada dato en su
 * `data-dato`, para poder comprobar la página sin depender de los textos.
 */
@Component({
  selector: 'app-verificacion',
  imports: [RouterLink],
  templateUrl: './verificacion.component.html',
  styleUrl: './verificacion.component.css',
})
export class VerificacionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly verificacion = inject(VerificacionService);
  private readonly identidad = inject(IdentidadCaceService);

  /** Identidad de la CACE, con respaldo si la configuración está vacía. */
  readonly logo = this.identidad.logo;
  readonly lema = this.identidad.lema;
  readonly descripcion = this.identidad.descripcion;

  readonly folio = signal('');
  readonly codigo = signal<string | null>(null);
  readonly cargando = signal(true);
  readonly resultado = signal<VerificacionCertificado | null>(null);
  readonly error = signal<string | null>(null);

  /**
   * El estado de la página para el atributo `data-verificacion`: los cuatro
   * desenlaces del servidor en minúsculas, más `cargando` y `error` (que es un
   * fallo de red, no un veredicto sobre el certificado).
   */
  readonly estadoPagina = computed(() => {
    if (this.cargando()) return 'cargando';
    if (this.error()) return 'error';
    return this.slug(this.resultado()?.estado ?? 'INVALIDO');
  });

  /** El certificado, solo cuando el servidor lo entregó. */
  readonly certificado = computed(() => this.resultado()?.certificado ?? null);

  ngOnInit(): void {
    const parametros = this.route.snapshot.paramMap;
    const consulta = this.route.snapshot.queryParamMap;
    this.folio.set(parametros.get('folio') ?? '');
    this.codigo.set(consulta.get('c'));

    // La identidad se pide igual que en el resto de la aplicación; si falla, el
    // servicio devuelve los textos y el logo de respaldo y la página se ve bien.
    this.identidad.cargar().subscribe({ error: () => {} });
    this.consultar();
  }

  /** Vuelve a preguntar (el botón de reintento cuando falla la red). */
  consultar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.verificacion.consultar(this.folio(), this.codigo()).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(
          extraerMensajeError(
            err,
            'No se pudo comprobar el certificado. Revisa tu conexión e inténtalo otra vez.',
          ),
        );
      },
    });
  }

  /** Fechas de la clase, en una sola línea: «01 mar 2026 — 30 may 2026». */
  get fechasClase(): string {
    const c = this.certificado();
    if (!c) return '';
    return `${fechaLarga(c.fechaInicio)} — ${fechaLarga(c.fechaFin)}`;
  }

  /** Las dos instituciones de la clase, juntas. */
  get instituciones(): string {
    const c = this.certificado();
    if (!c) return '';
    return `${c.institucionOrigen} · ${c.institucionDestino}`;
  }

  /** Cuándo se emitió, con hora: es un instante, no un día de calendario. */
  get emitido(): string {
    return fechaHoraLarga(this.certificado()?.emitidoEn);
  }

  /** `true` cuando el certificado existe pero está anulado. */
  get anulado(): boolean {
    return this.resultado()?.estado === 'ANULADO';
  }

  private slug(estado: string): string {
    return estado.toLowerCase().replace(/_/g, '-');
  }
}
