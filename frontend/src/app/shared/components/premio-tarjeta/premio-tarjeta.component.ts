import { Component, computed, input } from '@angular/core';
import { Premio } from '../../../core/models/cace-identidad.models';
import { urlDeArchivo } from '../../../core/utils/url-archivo.util';

/**
 * La ficha **formal** de un premio de la CACE, tal como se exhibe en el
 * carrusel de la sección «Comunidad»: la pieza de exhibición (la imagen), el
 * título, el año, a quién se le otorgó y el enlace para ver o descargar el
 * certificado, que es lo que acredita el reconocimiento.
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

  /** Certificado listo para abrir o descargar, si lo tiene. */
  readonly certificado = computed(() =>
    urlDeArchivo(this.premio().certificadoUrl),
  );

  /** «2026 · Otorgado a Fulano · Institución», sin partes vacías. */
  readonly otorgamiento = computed(() => {
    const premio = this.premio();
    return [
      String(premio.anio),
      `Otorgado a ${premio.otorgadoA}`,
      premio.institucionNombre,
    ]
      .filter((parte) => !!parte)
      .join(' · ');
  });
}
