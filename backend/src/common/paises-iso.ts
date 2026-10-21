/**
 * Catálogo de países de la sección «Comunidad» de la CACE.
 *
 * Existe para que al añadir una bandera se pueda escribir **el nombre** además
 * del código ISO: no todo el mundo recuerda que México es `MX`. La lista es la
 * misma del registro (`frontend/src/app/core/constants/catalogos.ts`); si se
 * añade un país allí, se copia aquí para que el servidor lo reconozca por nombre.
 *
 * La comparación por nombre ignora mayúsculas, tildes y espacios de más, así que
 * «mexico», «MÉXICO» y « México » llevan al mismo país.
 */
export interface PaisIso {
  codigo: string;
  nombre: string;
}

export const PAISES_ISO: readonly PaisIso[] = [
  { codigo: 'AF', nombre: 'Afganistán' },
  { codigo: 'AL', nombre: 'Albania' },
  { codigo: 'DE', nombre: 'Alemania' },
  { codigo: 'AD', nombre: 'Andorra' },
  { codigo: 'AO', nombre: 'Angola' },
  { codigo: 'AG', nombre: 'Antigua y Barbuda' },
  { codigo: 'SA', nombre: 'Arabia Saudita' },
  { codigo: 'DZ', nombre: 'Argelia' },
  { codigo: 'AR', nombre: 'Argentina' },
  { codigo: 'AM', nombre: 'Armenia' },
  { codigo: 'AU', nombre: 'Australia' },
  { codigo: 'AT', nombre: 'Austria' },
  { codigo: 'AZ', nombre: 'Azerbaiyán' },
  { codigo: 'BS', nombre: 'Bahamas' },
  { codigo: 'BD', nombre: 'Bangladés' },
  { codigo: 'BB', nombre: 'Barbados' },
  { codigo: 'BH', nombre: 'Baréin' },
  { codigo: 'BE', nombre: 'Bélgica' },
  { codigo: 'BZ', nombre: 'Belice' },
  { codigo: 'BJ', nombre: 'Benín' },
  { codigo: 'BY', nombre: 'Bielorrusia' },
  { codigo: 'BO', nombre: 'Bolivia' },
  { codigo: 'BA', nombre: 'Bosnia y Herzegovina' },
  { codigo: 'BW', nombre: 'Botsuana' },
  { codigo: 'BR', nombre: 'Brasil' },
  { codigo: 'BN', nombre: 'Brunéi' },
  { codigo: 'BG', nombre: 'Bulgaria' },
  { codigo: 'BF', nombre: 'Burkina Faso' },
  { codigo: 'BI', nombre: 'Burundi' },
  { codigo: 'BT', nombre: 'Bután' },
  { codigo: 'CV', nombre: 'Cabo Verde' },
  { codigo: 'KH', nombre: 'Camboya' },
  { codigo: 'CM', nombre: 'Camerún' },
  { codigo: 'CA', nombre: 'Canadá' },
  { codigo: 'TD', nombre: 'Chad' },
  { codigo: 'CL', nombre: 'Chile' },
  { codigo: 'CN', nombre: 'China' },
  { codigo: 'CY', nombre: 'Chipre' },
  { codigo: 'CO', nombre: 'Colombia' },
  { codigo: 'KM', nombre: 'Comoras' },
  { codigo: 'CG', nombre: 'Congo' },
  { codigo: 'KR', nombre: 'Corea del Sur' },
  { codigo: 'KP', nombre: 'Corea del Norte' },
  { codigo: 'CI', nombre: 'Costa de Marfil' },
  { codigo: 'CR', nombre: 'Costa Rica' },
  { codigo: 'HR', nombre: 'Croacia' },
  { codigo: 'CU', nombre: 'Cuba' },
  { codigo: 'DK', nombre: 'Dinamarca' },
  { codigo: 'DM', nombre: 'Dominica' },
  { codigo: 'EC', nombre: 'Ecuador' },
  { codigo: 'EG', nombre: 'Egipto' },
  { codigo: 'SV', nombre: 'El Salvador' },
  { codigo: 'AE', nombre: 'Emiratos Árabes Unidos' },
  { codigo: 'ER', nombre: 'Eritrea' },
  { codigo: 'SK', nombre: 'Eslovaquia' },
  { codigo: 'SI', nombre: 'Eslovenia' },
  { codigo: 'ES', nombre: 'España' },
  { codigo: 'US', nombre: 'Estados Unidos' },
  { codigo: 'EE', nombre: 'Estonia' },
  { codigo: 'SZ', nombre: 'Esuatini' },
  { codigo: 'ET', nombre: 'Etiopía' },
  { codigo: 'PH', nombre: 'Filipinas' },
  { codigo: 'FI', nombre: 'Finlandia' },
  { codigo: 'FJ', nombre: 'Fiyi' },
  { codigo: 'FR', nombre: 'Francia' },
  { codigo: 'GA', nombre: 'Gabón' },
  { codigo: 'GM', nombre: 'Gambia' },
  { codigo: 'GE', nombre: 'Georgia' },
  { codigo: 'GH', nombre: 'Ghana' },
  { codigo: 'GD', nombre: 'Granada' },
  { codigo: 'GR', nombre: 'Grecia' },
  { codigo: 'GT', nombre: 'Guatemala' },
  { codigo: 'GN', nombre: 'Guinea' },
  { codigo: 'GQ', nombre: 'Guinea Ecuatorial' },
  { codigo: 'GY', nombre: 'Guyana' },
  { codigo: 'HT', nombre: 'Haití' },
  { codigo: 'HN', nombre: 'Honduras' },
  { codigo: 'HK', nombre: 'Hong Kong' },
  { codigo: 'HU', nombre: 'Hungría' },
  { codigo: 'IN', nombre: 'India' },
  { codigo: 'ID', nombre: 'Indonesia' },
  { codigo: 'IQ', nombre: 'Irak' },
  { codigo: 'IR', nombre: 'Irán' },
  { codigo: 'IE', nombre: 'Irlanda' },
  { codigo: 'IS', nombre: 'Islandia' },
  { codigo: 'IL', nombre: 'Israel' },
  { codigo: 'IT', nombre: 'Italia' },
  { codigo: 'JM', nombre: 'Jamaica' },
  { codigo: 'JP', nombre: 'Japón' },
  { codigo: 'JO', nombre: 'Jordania' },
  { codigo: 'KZ', nombre: 'Kazajistán' },
  { codigo: 'KE', nombre: 'Kenia' },
  { codigo: 'KG', nombre: 'Kirguistán' },
  { codigo: 'KI', nombre: 'Kiribati' },
  { codigo: 'KW', nombre: 'Kuwait' },
  { codigo: 'LA', nombre: 'Laos' },
  { codigo: 'LS', nombre: 'Lesoto' },
  { codigo: 'LV', nombre: 'Letonia' },
  { codigo: 'LB', nombre: 'Líbano' },
  { codigo: 'LR', nombre: 'Liberia' },
  { codigo: 'LY', nombre: 'Libia' },
  { codigo: 'LI', nombre: 'Liechtenstein' },
  { codigo: 'LT', nombre: 'Lituania' },
  { codigo: 'LU', nombre: 'Luxemburgo' },
  { codigo: 'MK', nombre: 'Macedonia del Norte' },
  { codigo: 'MG', nombre: 'Madagascar' },
  { codigo: 'MY', nombre: 'Malasia' },
  { codigo: 'MW', nombre: 'Malaui' },
  { codigo: 'MV', nombre: 'Maldivas' },
  { codigo: 'ML', nombre: 'Malí' },
  { codigo: 'MT', nombre: 'Malta' },
  { codigo: 'MA', nombre: 'Marruecos' },
  { codigo: 'MH', nombre: 'Islas Marshall' },
  { codigo: 'MU', nombre: 'Mauricio' },
  { codigo: 'MR', nombre: 'Mauritania' },
  { codigo: 'MX', nombre: 'México' },
  { codigo: 'FM', nombre: 'Micronesia' },
  { codigo: 'MD', nombre: 'Moldavia' },
  { codigo: 'MC', nombre: 'Mónaco' },
  { codigo: 'MN', nombre: 'Mongolia' },
  { codigo: 'ME', nombre: 'Montenegro' },
  { codigo: 'MZ', nombre: 'Mozambique' },
  { codigo: 'MM', nombre: 'Birmania (Myanmar)' },
  { codigo: 'NA', nombre: 'Namibia' },
  { codigo: 'NR', nombre: 'Nauru' },
  { codigo: 'NP', nombre: 'Nepal' },
  { codigo: 'NI', nombre: 'Nicaragua' },
  { codigo: 'NE', nombre: 'Níger' },
  { codigo: 'NG', nombre: 'Nigeria' },
  { codigo: 'NO', nombre: 'Noruega' },
  { codigo: 'NZ', nombre: 'Nueva Zelanda' },
  { codigo: 'OM', nombre: 'Omán' },
  { codigo: 'NL', nombre: 'Países Bajos' },
  { codigo: 'PK', nombre: 'Pakistán' },
  { codigo: 'PW', nombre: 'Palaos' },
  { codigo: 'PA', nombre: 'Panamá' },
  { codigo: 'PG', nombre: 'Papúa Nueva Guinea' },
  { codigo: 'PY', nombre: 'Paraguay' },
  { codigo: 'PE', nombre: 'Perú' },
  { codigo: 'PL', nombre: 'Polonia' },
  { codigo: 'PT', nombre: 'Portugal' },
  { codigo: 'QA', nombre: 'Catar' },
  { codigo: 'GB', nombre: 'Reino Unido' },
  { codigo: 'CF', nombre: 'República Centroafricana' },
  { codigo: 'CZ', nombre: 'Chequia' },
  { codigo: 'CD', nombre: 'Rep. Democrática del Congo' },
  { codigo: 'DO', nombre: 'República Dominicana' },
  { codigo: 'RU', nombre: 'Rusia' },
  { codigo: 'RW', nombre: 'Ruanda' },
  { codigo: 'RO', nombre: 'Rumania' },
  { codigo: 'WS', nombre: 'Samoa' },
  { codigo: 'SM', nombre: 'San Marino' },
  { codigo: 'LC', nombre: 'Santa Lucía' },
  { codigo: 'KN', nombre: 'San Cristóbal y Nieves' },
  { codigo: 'ST', nombre: 'Santo Tomé y Príncipe' },
  { codigo: 'VC', nombre: 'San Vicente y las Granadinas' },
  { codigo: 'SN', nombre: 'Senegal' },
  { codigo: 'RS', nombre: 'Serbia' },
  { codigo: 'SC', nombre: 'Seychelles' },
  { codigo: 'SL', nombre: 'Sierra Leona' },
  { codigo: 'SG', nombre: 'Singapur' },
  { codigo: 'SY', nombre: 'Siria' },
  { codigo: 'SO', nombre: 'Somalia' },
  { codigo: 'LK', nombre: 'Sri Lanka' },
  { codigo: 'ZA', nombre: 'Sudáfrica' },
  { codigo: 'SD', nombre: 'Sudán' },
  { codigo: 'SS', nombre: 'Sudán del Sur' },
  { codigo: 'SE', nombre: 'Suecia' },
  { codigo: 'CH', nombre: 'Suiza' },
  { codigo: 'SR', nombre: 'Surinam' },
  { codigo: 'TH', nombre: 'Tailandia' },
  { codigo: 'TW', nombre: 'Taiwán' },
  { codigo: 'TZ', nombre: 'Tanzania' },
  { codigo: 'TJ', nombre: 'Tayikistán' },
  { codigo: 'TL', nombre: 'Timor Oriental' },
  { codigo: 'TG', nombre: 'Togo' },
  { codigo: 'TO', nombre: 'Tonga' },
  { codigo: 'TT', nombre: 'Trinidad y Tobago' },
  { codigo: 'TN', nombre: 'Túnez' },
  { codigo: 'TM', nombre: 'Turkmenistán' },
  { codigo: 'TR', nombre: 'Turquía' },
  { codigo: 'TV', nombre: 'Tuvalu' },
  { codigo: 'UA', nombre: 'Ucrania' },
  { codigo: 'UG', nombre: 'Uganda' },
  { codigo: 'UY', nombre: 'Uruguay' },
  { codigo: 'UZ', nombre: 'Uzbekistán' },
  { codigo: 'VU', nombre: 'Vanuatu' },
  { codigo: 'VA', nombre: 'Ciudad del Vaticano' },
  { codigo: 'VE', nombre: 'Venezuela' },
  { codigo: 'VN', nombre: 'Vietnam' },
  { codigo: 'YE', nombre: 'Yemen' },
  { codigo: 'ZM', nombre: 'Zambia' },
  { codigo: 'ZW', nombre: 'Zimbabue' },
] as const;

/**
 * Nombres coloquiales o alternativos que la lista oficial no usa. La clave se
 * normaliza igual que los nombres del catálogo.
 */
const ALIAS: Record<string, string> = {
  eeuu: 'US',
  'ee.uu.': 'US',
  'ee uu': 'US',
  usa: 'US',
  'estados unidos de america': 'US',
  uk: 'GB',
  'gran bretana': 'GB',
  inglaterra: 'GB',
  holanda: 'NL',
  'republica checa': 'CZ',
  chequia: 'CZ',
  vaticano: 'VA',
  'ciudad del vaticano': 'VA',
  suazilandia: 'SZ',
  eswatini: 'SZ',
  'costa de marfil': 'CI',
  'cote d ivoire': 'CI',
};

/** Minúsculas, sin tildes y con los espacios simples. */
function clave(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const POR_CODIGO = new Map(PAISES_ISO.map((pais) => [pais.codigo, pais]));
const POR_NOMBRE = new Map(
  PAISES_ISO.map((pais) => [clave(pais.nombre), pais]),
);
for (const [alias, codigo] of Object.entries(ALIAS)) {
  const pais = POR_CODIGO.get(codigo);
  if (pais) POR_NOMBRE.set(clave(alias), pais);
}

/**
 * Devuelve el país del catálogo a partir de un código ISO (`MX`, `mx`) o de un
 * nombre (`México`, `mexico`, `EE.UU.`). `null` si no lo reconoce.
 */
export function resolverPaisIso(valor: string): PaisIso | null {
  const texto = (valor ?? '').trim();
  if (!texto) return null;
  if (/^[A-Za-z]{2}$/.test(texto)) {
    return POR_CODIGO.get(texto.toUpperCase()) ?? null;
  }
  return POR_NOMBRE.get(clave(texto)) ?? null;
}

/** País por código ISO exacto (para completar el nombre al editar). */
export function paisPorCodigo(codigo: string): PaisIso | null {
  return POR_CODIGO.get((codigo ?? '').trim().toUpperCase()) ?? null;
}
