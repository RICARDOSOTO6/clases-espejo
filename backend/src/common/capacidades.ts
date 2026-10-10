/**
 * Capacidades del sistema: qué puede hacer cada rol.
 *
 * Antes cada servicio comparaba el rol a mano (`rol === 'AGENTE'`), y con cuatro
 * roles eso se vuelve inmanejable: cualquier cambio de permisos obliga a buscar
 * todas las comparaciones. Aquí la tabla está en un solo sitio, y el código
 * pregunta por la **capacidad**, no por el rol.
 */

export const ROLES = [
  'DOCENTE',
  'AGENTE',
  'PRESIDENTE_CACE',
  'SECRETARIA_CACE',
] as const;
export type Rol = (typeof ROLES)[number];

export const CAPACIDADES = [
  /** Aprobar, rechazar y vetar instituciones. */
  'aprobarInstituciones',
  /**
   * Borrar definitivamente una institución rechazada (solo si no tiene
   * historia). La secretaría **no** la tiene: su caso, «con autorización del
   * presidente», queda fuera de esta parte.
   */
  'borrarInstituciones',
  /** Dar por bueno el alta de un agente nuevo en una institución ya aprobada. */
  'confirmarAgenteInstitucion',
  /** Logo, textos, banderas y tema de la CACE. */
  'personalizarCace',
  /** Premios y reconocimientos. */
  'publicarPremios',
  /** Crear y editar la plantilla del certificado. */
  'disenarCertificados',
  /** Firmar los certificados emitidos. */
  'firmarCertificados',
  /** Emitir los certificados de sus alumnos (lo hacen los docentes). */
  'emitirCertificados',
] as const;
export type Capacidad = (typeof CAPACIDADES)[number];

/** La tabla de permisos. Añadir una secretaría nueva es añadir una fila. */
const MATRIZ: Record<Rol, Capacidad[]> = {
  DOCENTE: ['emitirCertificados'],
  AGENTE: ['confirmarAgenteInstitucion'],
  PRESIDENTE_CACE: [
    'aprobarInstituciones',
    'borrarInstituciones',
    'personalizarCace',
    'publicarPremios',
    'disenarCertificados',
    'firmarCertificados',
  ],
  // La secretaría ayuda con la imagen y los premios, pero no firma ni veta.
  SECRETARIA_CACE: ['personalizarCace', 'publicarPremios'],
};

export function esRolValido(rol: string | null | undefined): rol is Rol {
  return !!rol && (ROLES as readonly string[]).includes(rol);
}

/**
 * Rol del usuario a partir de sus filas relacionales.
 *
 * El rol **no** es una columna de USUARIO: alguien es agente si tiene fila en
 * AGENTE, docente si la tiene en DOCENTE y miembro de la CACE si la tiene en
 * MIEMBRO_CACE. Presidencia y suplencia comparten rol (las capacidades las
 * reparte la matriz de arriba), y una fila de miembro inactiva no cuenta.
 */
export function rolDeVinculos(vinculos: {
  agente?: unknown;
  docente?: unknown;
  miembroCace?: { cargo: string; activo: boolean } | null;
}): Rol | null {
  const miembro = vinculos.miembroCace?.activo ? vinculos.miembroCace : null;
  if (miembro) {
    return miembro.cargo === 'SECRETARIA'
      ? 'SECRETARIA_CACE'
      : 'PRESIDENTE_CACE';
  }
  if (vinculos.agente) return 'AGENTE';
  if (vinculos.docente) return 'DOCENTE';
  return null;
}

/** Las capacidades de un rol (vacío si el rol no se reconoce). */
export function capacidadesDe(rol: string | null | undefined): Capacidad[] {
  return esRolValido(rol) ? [...MATRIZ[rol]] : [];
}

/** ¿Este rol puede hacer esto? */
export function puede(
  rol: string | null | undefined,
  capacidad: Capacidad,
): boolean {
  return capacidadesDe(rol).includes(capacidad);
}

/** Etiqueta del rol para mostrarlo en la interfaz. */
export const ETIQUETA_ROL: Record<Rol, string> = {
  DOCENTE: 'Docente',
  AGENTE: 'Agente de internacionalización',
  PRESIDENTE_CACE: 'Presidente de la CACE',
  SECRETARIA_CACE: 'Secretaría de la CACE',
};
