import { PAISES_CACE } from './catalogos';

/**
 * Temas visuales de la CACE.
 *
 * Es una lista **cerrada** a propósito (el presidente elige, no inventa el
 * color): un color libre rompe el contraste y la accesibilidad. La clave es la
 * que se guarda en la base y la que el frontend pone como atributo `data-tema`;
 * los colores de cada tema viven en `styles.css`.
 */
export type TemaCace = 'AZUL' | 'VERDE' | 'VINO' | 'OSCURO';

/** Tema inicial y de respaldo: el azul con el que ya se veía la aplicación. */
export const TEMA_CACE_POR_DEFECTO: TemaCace = 'AZUL';

interface OpcionTema {
  valor: TemaCace;
  etiqueta: string;
  descripcion: string;
  /** Color de la muestra del formulario (solo para pintar el circulito). */
  muestra: string;
}

export const TEMAS_CACE: OpcionTema[] = [
  {
    valor: 'AZUL',
    etiqueta: 'Azul institucional',
    descripcion: 'El tema de siempre: azul, claro y sobrio.',
    muestra: '#0069aa',
  },
  {
    valor: 'VERDE',
    etiqueta: 'Verde',
    descripcion: 'La misma identidad en verde, para quien asocia la CACE al verde.',
    muestra: '#1a7f4b',
  },
  {
    valor: 'VINO',
    etiqueta: 'Vino',
    descripcion: 'Granate universitario, con más peso institucional.',
    muestra: '#9d1f3f',
  },
  {
    valor: 'OSCURO',
    etiqueta: 'Oscuro',
    descripcion: 'Fondos oscuros y texto claro, para pantallas con poca luz.',
    muestra: '#1e293b',
  },
];

/**
 * Textos de respaldo de la CACE.
 *
 * Son los que hoy están fijos en el frontend (el lema de la portada, el nombre
 * de la comunidad y el logo del proyecto). Si la configuración está vacía —base
 * recién migrada, o el presidente todavía no ha escrito nada— la aplicación se
 * ve exactamente como antes en lugar de quedarse con huecos.
 */
export const LEMA_CACE_POR_DEFECTO = 'Uniendo mentes, corazones y proyectos';
export const DESCRIPCION_CACE_POR_DEFECTO = 'Comunidad de Apoyo a Clases Espejo';
export const LOGO_CACE_POR_DEFECTO = 'logo-cace.png';

/**
 * Banderas de respaldo: los 18 países que hasta la fase 3 eran una lista fija
 * (`PAISES_CACE`) y que ahora se cargan en `PAIS_COMUNIDAD`. Se usan solo si la
 * tabla quedara vacía.
 */
export const PAISES_COMUNIDAD_POR_DEFECTO: { codigo: string; nombre: string }[] =
  PAISES_CACE.map((pais) => ({ codigo: pais.codigo, nombre: pais.nombre }));
