/**
 * Capacidades del sistema: qué puede hacer cada rol.
 *
 * Antes cada servicio comparaba el rol a mano (`rol === 'AGENTE'`), y con cuatro
 * roles eso se vuelve inmanejable: cualquier cambio de permisos obliga a buscar
 * todas las comparaciones. Aquí la tabla está en un solo sitio, y el código
 * pregunta por la **capacidad**, no por el rol.
 */

const ROLES = [
  'DOCENTE',
  'AGENTE',
  'SECRETARIA_INSTITUCION',
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
   * presidente», va por `solicitarBorradoInstitucion`.
   */
  'borrarInstituciones',
  /**
   * Pedir el borrado definitivo de una institución rechazada. Es la capacidad
   * de la secretaría: la petición no borra nada, la tiene que aprobar el
   * presidente (`resolverSolicitudesBorrado`). Así el borrado queda autorizado
   * por quien responde por él.
   */
  'solicitarBorradoInstitucion',
  /**
   * Aprobar o rechazar las solicitudes de borrado. La tiene el presidente, y al
   * aprobar es él quien ejecuta el borrado (con las mismas reglas que el
   * borrado directo).
   */
  'resolverSolicitudesBorrado',
  /**
   * Dar de alta y activar o desactivar a los miembros de la CACE (las
   * secretarías). Solo la presidencia: es quien reparte el trabajo.
   */
  'gestionarMiembrosCace',
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
  /**
   * Anular un certificado ya emitido, con motivo. La tiene el docente que lo
   * emitió (para los certificados de su institución) y la presidencia, que
   * responde por lo que firma la CACE.
   */
  'anularCertificados',
  /** La secretaría institucional mantiene el contacto y el logo de su institución. */
  'editarContactoInstitucion',
  /** La secretaría institucional puede invitar y activar docentes de su institución. */
  'gestionarDocentesInstitucion',
  /** Ver conteos de su institución sin datos nominales de alumnos. */
  'verResumenInstitucion',
] as const;
export type Capacidad = (typeof CAPACIDADES)[number];

/** La tabla de permisos. Añadir una secretaría nueva es añadir una fila. */
const MATRIZ: Record<Rol, Capacidad[]> = {
  DOCENTE: ['emitirCertificados', 'anularCertificados'],
  AGENTE: ['confirmarAgenteInstitucion'],
  SECRETARIA_INSTITUCION: [
    'editarContactoInstitucion',
    'gestionarDocentesInstitucion',
    'verResumenInstitucion',
  ],
  PRESIDENTE_CACE: [
    'aprobarInstituciones',
    'borrarInstituciones',
    'resolverSolicitudesBorrado',
    'gestionarMiembrosCace',
    'personalizarCace',
    'publicarPremios',
    'disenarCertificados',
    'firmarCertificados',
    'anularCertificados',
  ],
  // La secretaría ayuda con la imagen y los premios, pero no firma ni veta ni
  // borra: el borrado lo **pide** y lo autoriza el presidente.
  SECRETARIA_CACE: [
    'personalizarCace',
    'publicarPremios',
    'solicitarBorradoInstitucion',
  ],
};

function esRolValido(rol: string | null | undefined): rol is Rol {
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
  secretariaInstitucion?: { activo: boolean } | null;
  miembroCace?: { cargo: string; activo: boolean } | null;
}): Rol | null {
  const miembro = vinculos.miembroCace?.activo ? vinculos.miembroCace : null;
  if (miembro) {
    return miembro.cargo === 'SECRETARIA'
      ? 'SECRETARIA_CACE'
      : 'PRESIDENTE_CACE';
  }
  if (vinculos.secretariaInstitucion?.activo) return 'SECRETARIA_INSTITUCION';
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
  SECRETARIA_INSTITUCION: 'Secretaría de institución',
  PRESIDENTE_CACE: 'Presidencia de la CACE',
  SECRETARIA_CACE: 'Secretaría de la CACE',
};
