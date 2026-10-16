import { Component, computed, input } from '@angular/core';
import { Premio } from '../../../core/models/cace-identidad.models';
import { TIPOS_RECONOCIMIENTO } from '../../../core/constants/cace';
import { urlDeArchivo } from '../../../core/utils/url-archivo.util';

/**
 * La ficha **formal** de un premio de la CACE, tal como se exhibe en el
 * carrusel de la sección «Comunidad»: la pieza de exhibición (la imagen), el
 * tipo, el año, la entidad otorgante y una fuente oficial o certificado para
 * verificar el reconocimiento.
 *
 * Solo se le pasan premios **publicados**: los certificados de los alumnos son
 * documentos personales y no tienen nada que hacer aquí.
 *
 * Si el premio no tiene imagen, la ficha se pinta igual con su emblema: un
 * premio sin pieza gráfica sigue siendo un premio, y un hueco roto no lo
 * explicaría.
 */
@Component({
  selector: 'app-premio-tarjeta',
  templateUrl: './premio-tarjeta.component.html',
  styleUrl: './premio-tarjeta.component.css',
})
export class PremioTarjetaComponent {
  /** Premio publicado que se exhibe. */
  readonly premio = input.required<Premio>();

  /** Pieza de exhibición (la imagen del carrusel), si la tiene. */
  readonly imagen = computed(() => urlDeArchivo(this.premio().imagenUrl));

  readonly etiquetaTipo = computed(
    () =>
      TIPOS_RECONOCIMIENTO.find((tipo) => tipo.valor === this.premio().tipo)?.etiqueta ??
      'Reconocimiento',
  );

  /** Certificado listo para abrir o descargar, si lo tiene. */
  readonly certificado = computed(() =>
    urlDeArchivo(this.premio().certificadoUrl),
  );

  /** Fuente oficial externa, si está registrada. */
  readonly fuente = computed(() => this.premio().fuenteUrl || null);

  /** «2026 · Entidad otorgante · Institución», sin partes vacías. */
  readonly otorgamiento = computed(() => {
    const premio = this.premio();
    return [
      String(premio.anio),
      `Entidad otorgante: ${premio.otorgadoA}`,
      premio.institucionNombre,
    ]
      .filter((parte) => !!parte)
      .join(' · ');
  });
}
