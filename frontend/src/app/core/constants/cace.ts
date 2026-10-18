import { PAISES_CACE } from './catalogos';

/**
 * Temas visuales de la CACE.
 *
 * Es una lista **cerrada** a propósito (el presidente elige, no inventa el
 * color): un color libre rompe el contraste y la accesibilidad. La clave es la
 * que se guarda en la base y la que el frontend pone como atributo `data-tema`;
 * los colores de cada tema viven en `styles.css`.
 */
export type TemaCace =
  | 'AZUL'
  | 'VERDE'
  | 'VINO'
  | 'OSCURO'
  | 'PRIMAVERA'
  | 'VERANO'
  | 'OTONO'
  | 'INVIERNO'
  | 'NAVIDAD'
  | 'ANIVERSARIO';

/** Tema inicial y de respaldo: el azul con el que ya se veía la aplicación. */
export const TEMA_CACE_POR_DEFECTO: TemaCace = 'AZUL';

export type TipoReconocimiento =
  | 'PREMIO'
  | 'RECONOCIMIENTO'
  | 'BUENA_PRACTICA'
  | 'MENCION'
  | 'SELECCION';

export const TIPOS_RECONOCIMIENTO: { valor: TipoReconocimiento; etiqueta: string }[] = [
  { valor: 'PREMIO', etiqueta: 'Premio' },
  { valor: 'RECONOCIMIENTO', etiqueta: 'Reconocimiento' },
  { valor: 'BUENA_PRACTICA', etiqueta: 'Buena práctica' },
  { valor: 'MENCION', etiqueta: 'Mención' },
  { valor: 'SELECCION', etiqueta: 'Selección' },
];

interface OpcionTema {
  valor: TemaCace;
  etiqueta: string;
  descripcion: string;
  /** Colores de muestra del formulario para comunicar que es una paleta. */
  muestra: string;
  muestraSecundaria: string;
}

export const TEMAS_CACE: OpcionTema[] = [
  {
    valor: 'AZUL',
    etiqueta: 'Azul institucional',
    descripcion: 'El tema de siempre: azul, claro y sobrio.',
    muestra: '#0069aa',
    muestraSecundaria: '#8bd3f7',
  },
  {
    valor: 'VERDE',
    etiqueta: 'Verde',
    descripcion: 'La misma identidad en verde, para quien asocia la CACE al verde.',
    muestra: '#1a7f4b',
    muestraSecundaria: '#8bd5aa',
  },
  {
    valor: 'VINO',
    etiqueta: 'Vino',
    descripcion: 'Granate universitario, con más peso institucional.',
    muestra: '#9d1f3f',
    muestraSecundaria: '#e58b9f',
  },
  {
    valor: 'OSCURO',
    etiqueta: 'Oscuro',
    descripcion: 'Fondos oscuros y texto claro, para pantallas con poca luz.',
    muestra: '#1e293b',
    muestraSecundaria: '#64748b',
  },
  {
    valor: 'PRIMAVERA',
    etiqueta: 'Primavera',
    descripcion: 'Verde hoja y menta para una identidad fresca y colaborativa.',
    muestra: '#2f6f4e',
    muestraSecundaria: '#8bd5aa',
  },
  {
    valor: 'VERANO',
    etiqueta: 'Verano',
    descripcion: 'Turquesa y coral con una energía luminosa para la comunidad.',
    muestra: '#0f6b78',
    muestraSecundaria: '#f08a69',
  },
  {
    valor: 'OTONO',
    etiqueta: 'Otoño',
    descripcion: 'Terracota y ámbar para una temporada cálida y cercana.',
    muestra: '#9a4d0f',
    muestraSecundaria: '#d99a3d',
  },
  {
    valor: 'INVIERNO',
    etiqueta: 'Invierno',
    descripcion: 'Azul pizarra y hielo para una interfaz serena y enfocada.',
    muestra: '#3b5b8a',
    muestraSecundaria: '#9fc5e8',
  },
  {
    valor: 'NAVIDAD',
    etiqueta: 'Navidad',
    descripcion: 'Verde bosque, rojo profundo y dorado para una celebración sobria.',
    muestra: '#8f1d2c',
    muestraSecundaria: '#c99a2e',
  },
  {
    valor: 'ANIVERSARIO',
    etiqueta: 'Aniversario CACE',
    descripcion: 'Índigo y dorado para celebrar la historia de la comunidad.',
    muestra: '#6b4ca3',
    muestraSecundaria: '#d1a64a',
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
export const LOGO_CACE_POR_DEFECTO = 'logo-cace.webp';

/**
 * Banderas de respaldo: los 18 países que hasta la fase 3 eran una lista fija
 * (`PAISES_CACE`) y que ahora se cargan en `PAIS_COMUNIDAD`. Se usan solo si la
 * tabla quedara vacía.
 */
export const PAISES_COMUNIDAD_POR_DEFECTO: { codigo: string; nombre: string }[] =
  PAISES_CACE.map((pais) => ({ codigo: pais.codigo, nombre: pais.nombre }));
