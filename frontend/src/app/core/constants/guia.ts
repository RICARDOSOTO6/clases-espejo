/**
 * Guía interactiva de la ayuda.
 *
 * Los recorridos están agrupados **por apartado**: la ventana de ayuda ofrece el
 * del apartado en el que estás (Inicio, Docentes, Materias, una clase espejo…)
 * y una lista para lanzar cualquier otro.
 *
 * Cada paso resalta un elemento real de la pantalla de dos maneras:
 *
 * - `selector`: un selector CSS (lo normal cuando el elemento tiene `id`).
 * - `boton`: el texto visible de un botón o enlace. Es más estable que un
 *   selector cuando el control no tiene `id` o su etiqueta cambia de forma
 *   dinámica (por ejemplo «Revisar (origen)»).
 *
 * Si un paso no lleva ninguno de los dos, sale como panel centrado para explicar
 * algo que no está a la vista. Y si el elemento no aparece (una sección
 * contraída, una solicitud que ya no está), el paso se salta solo: la guía nunca
 * se queda colgada.
 *
 * `accion` le pide algo a la pantalla (abrir un formulario, abrir el calendario)
 * para poder señalar campos que solo existen dentro de una ventana.
 */

/** Acción que la guía le pide a la pantalla al entrar en un paso. */
type AccionGuia =
  | 'abrir-solicitud'
  | 'cerrar-solicitud'
  | 'abrir-invitacion'
  | 'cerrar-invitacion'
  | 'abrir-calendario';

/** Un paso del recorrido. */
export interface PasoGuia {
  /** Selector CSS del elemento a señalar. */
  selector?: string;
  /** Texto visible del botón o enlace a señalar (alternativa al selector). */
  boton?: string;
  titulo: string;
  texto: string;
  /** Acción que la pantalla debe ejecutar al entrar en el paso. */
  accion?: AccionGuia;
}

/** Un recorrido completo de un apartado. */
export interface GuiaSeccion {
  /**
   * Id del apartado, igual que en el menú lateral. Hay dos especiales:
   * `completo` (el recorrido largo de principio a fin) y `proyecto` (la pantalla
   * de una clase espejo).
   */
  id: string;
  /** Nombre del apartado tal como se ve en el menú. */
  titulo: string;
  /** Una línea para la lista de la ventana de ayuda. */
  resumen: string;
  pasos: PasoGuia[];
}

/** Busca el recorrido de un apartado; `undefined` si ese apartado no tiene. */
export function buscarGuia(
  guias: GuiaSeccion[],
  id: string | null,
): GuiaSeccion | undefined {
  return id ? guias.find((guia) => guia.id === id) : undefined;
}

/** El aviso de la campana, que está en la barra superior de todas las pantallas. */
const CAMPANA = '.navbar-icon[aria-label^="Notificaciones"]';

// ---------------------------------------------------------------------------
// DOCENTE
// ---------------------------------------------------------------------------

export const GUIA_DOCENTE: GuiaSeccion[] = [
  {
    id: 'completo',
    titulo: 'Tu primera solicitud (de principio a fin)',
    resumen:
      'El recorrido largo: proponer la clase, esperar la doble revisión y verla aprobada.',
    pasos: [
      {
        selector: '.welcome',
        titulo: 'Este es tu panel',
        texto:
          'Aquí ves tus solicitudes y tus clases espejo. Te acompaño paso a paso para que hagas tu primera propuesta.',
      },
      {
        selector: '.welcome-action',
        titulo: 'Empieza aquí',
        texto:
          'Pulsa «Nueva solicitud» cuando quieras proponer una clase espejo a otra institución.',
      },
      {
        accion: 'abrir-solicitud',
        selector: '#s-origen',
        titulo: '1. Materia de origen',
        texto:
          'Elige cuál de tus materias asignadas quieres compartir. Solo aparecen las que tu agente te asignó.',
      },
      {
        selector: '#s-destino',
        titulo: '2. Institución destino',
        texto:
          'A qué institución le propones la clase. Solo salen las que ya completaron su registro.',
      },
      {
        selector: '#s-materia-destino',
        titulo: '3. Materia destino (opcional)',
        texto:
          'Si la otra institución tiene una materia equivalente, elígela aquí. Puedes dejarla vacía y acordarla después con el otro docente.',
      },
      {
        selector: '#s-titulo',
        titulo: '4. Título y objetivo',
        texto:
          'Un nombre claro y qué se busca lograr con la experiencia conjunta. Es lo primero que leerán los agentes al revisarla.',
      },
      {
        selector: '#s-fecha',
        titulo: '5. Fecha propuesta',
        texto:
          'Con cuánta antelación quieres darla. Debe respetar los días mínimos de revisión: si no, el sistema la cancelaría sola.',
      },
      {
        selector: 'app-modal button[type="submit"]',
        titulo: 'Envía la propuesta',
        texto:
          'Al guardar, tu solicitud queda en estado «Pendiente» y pasa a revisión.',
      },
      {
        accion: 'cerrar-solicitud',
        selector: '#solicitudes',
        titulo: 'Ahora toca esperar (poco)',
        texto:
          'Tu solicitud aparece aquí como «Pendiente». Primero la revisa el agente de tu institución y después el de la institución destino: hasta que las dos aprueben no se crea la clase. En la tarjeta verás cuántos días quedan; si nadie responde a tiempo, caduca sola.',
      },
      {
        selector: CAMPANA,
        titulo: 'No tienes que vigilarla',
        texto:
          'La campana te avisa de lo que está pendiente en esta pantalla, y el calendario muestra las sesiones y los vencimientos.',
      },
      {
        selector: '#proyectos',
        titulo: 'Cuando la aprueben',
        texto:
          'Tu solicitud se convierte en una clase espejo y aparece en esta lista: ahí completas la planificación, programas sesiones y firmas el reporte de cada clase.',
      },
      {
        titulo: '¡Eso es todo!',
        texto:
          'Ya sabes hacer tu primera solicitud y qué pasa después. Puedes repetir esta guía desde «Ayuda» cuando quieras.',
      },
    ],
  },

  {
    id: 'inicio',
    titulo: 'Inicio',
    resumen: 'Tu panel: los indicadores, lo que viene y por dónde empezar.',
    pasos: [
      {
        selector: '.welcome',
        titulo: 'Este es tu panel',
        texto:
          'Aquí ves tu nombre y cuatro indicadores: cuántas solicitudes has hecho, cuántas esperan revisión, cuántas te aprobaron y a cuántas instituciones puedes proponerles una clase.',
      },
      {
        selector: '.welcome-action',
        titulo: 'Empieza por aquí',
        texto:
          '«Nueva solicitud» es el atajo para proponer una clase espejo. Si quieres, después lanza el recorrido «Tu primera solicitud» y te explico el formulario campo por campo.',
      },
      {
        selector: '#recordatorios',
        titulo: 'Lo que viene y lo que te toca',
        texto:
          '«Lo próximo» reúne tus clases y las fechas límite; «Por hacer», lo que espera por ti. Se llena solo, no tienes que apuntar nada.',
      },
      {
        selector: CAMPANA,
        titulo: 'Tu aviso diario',
        texto:
          'La campana junta lo pendiente de esta pantalla y te baja a la sección al pulsarlo.',
      },
      {
        selector: '#comunidad',
        titulo: 'La comunidad CACE',
        texto:
          'Las instituciones con las que puedes trabajar. Solo aparecen las que ya completaron su registro.',
      },
    ],
  },

  {
    id: 'solicitudes',
    titulo: 'Mis solicitudes',
    resumen: 'Cómo leer el estado de tus propuestas y qué pasa mientras esperas.',
    pasos: [
      {
        selector: '#solicitudes',
        titulo: 'Tus propuestas',
        texto:
          'Cada fila es una solicitud: su estado, la institución a la que se la propusiste y la fecha. El buscador de la barra superior filtra esta lista.',
      },
      {
        titulo: 'Pendiente, aprobada por origen, aprobada',
        texto:
          'La revisión es doble: primero dice sí el agente de tu institución y después el de la institución destino. Cuando las dos aprueban, la clase espejo se crea sola y la ves en «Mis clases espejo».',
      },
      {
        titulo: 'Mientras esperas no tienes que hacer nada',
        texto:
          'En la tarjeta verás la fecha límite y una marca de urgencia. Si nadie revisa a tiempo, la solicitud caduca sola y puedes crear otra: no estorba y no hay que escribirle a nadie.',
      },
      {
        boton: 'Editar',
        titulo: 'Si quieres cambiarla',
        texto:
          'Mientras siga pendiente puedes corregirla con «Editar»; al guardar vuelve a revisión desde el principio. Si te la rechazaron, el motivo aparece en la solicitud y puedes reenviarla corregida.',
      },
    ],
  },

  {
    id: 'proyectos',
    titulo: 'Mis clases espejo',
    resumen: 'Dónde están tus clases aprobadas y qué se hace dentro.',
    pasos: [
      {
        selector: '#proyectos',
        titulo: 'Tus clases espejo',
        texto:
          'Aquí aparecen las clases que ya se aprobaron. Cada una tiene su propia pantalla: se abre con «Abrir».',
      },
      {
        boton: 'Abrir',
        titulo: 'Entra a la clase',
        texto:
          'Dentro está todo: los datos, los docentes de las dos instituciones, la planificación conjunta, las sesiones, las actividades, las evidencias, la evaluación y el cierre.',
      },
      {
        titulo: 'Pide ayuda otra vez dentro',
        texto:
          'Cuando estés dentro de una clase espejo, abre «Ayuda» de nuevo: te explico esa pantalla apartado por apartado, con sus fechas, firmas y evidencias.',
      },
    ],
  },

  {
    id: 'calendario',
    titulo: 'Calendario',
    resumen: 'El mes completo con lo que vence y lo que tienes programado.',
    pasos: [
      {
        selector: CAMPANA,
        titulo: 'Lo urgente, primero',
        texto:
          'La campana muestra lo pendiente de esta pantalla. Si algo está por vencer, aparece marcado aquí.',
      },
      {
        accion: 'abrir-calendario',
        selector: '.calendario-grid',
        titulo: 'El mes entero',
        texto:
          'Cada día con algo tiene su punto: solicitudes que vencen, clases y sesiones. Pulsa un día para ver qué hay ese día.',
      },
      {
        selector: '.calendario-lado',
        titulo: 'El detalle del día',
        texto:
          'A un lado ves la lista de lo que toca ese día, con la urgencia marcada. Desde ahí puedes ir directo a la clase.',
      },
      {
        titulo: 'Cierra cuando termines',
        texto:
          'Con la tecla Esc o con la ✕ vuelves a tu panel. La guía se cierra contigo.',
      },
    ],
  },

  {
    id: 'comunidad',
    titulo: 'Comunidad',
    resumen: 'Los países y las instituciones que forman la red CACE.',
    pasos: [
      {
        selector: '#comunidad',
        titulo: 'La comunidad CACE',
        texto:
          'Los países que forman la Comunidad de Apoyo a Clases Espejo. Puedes proponer clases a instituciones de cualquiera de ellos.',
      },
      {
        titulo: '¿Y si no aparece la institución que busco?',
        texto:
          'Solo se listan las instituciones con el registro completo. Si la tuya de destino no aparece, es que aún le faltan datos: su agente tiene que completarlos.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// AGENTE
// ---------------------------------------------------------------------------

export const GUIA_AGENTE: GuiaSeccion[] = [
  {
    id: 'completo',
    titulo: 'Preparar tu institución (de principio a fin)',
    resumen:
      'El recorrido largo: institución, docentes, materias y revisión de propuestas.',
    pasos: [
      {
        selector: '.welcome',
        titulo: 'Este es tu panel',
        texto:
          'Aquí gestionas tu institución, sus docentes y sus materias, y revisas lo que proponen otras instituciones.',
      },
      {
        selector: '.welcome-action',
        titulo: 'Empieza invitando a un docente',
        texto:
          'Los docentes no se registran solos: tú los invitas y ellos activan su cuenta desde el correo.',
      },
      {
        accion: 'abrir-invitacion',
        selector: '#d-correo',
        titulo: 'El formulario de invitación',
        texto:
          'Solo hacen falta dos datos: el correo del docente y su número de empleado. Al enviar, le llega un correo con un enlace que solo puede usar una vez.',
      },
      {
        accion: 'cerrar-invitacion',
        selector: '#docentes',
        titulo: 'Docentes de tu institución',
        texto:
          'Cuando el docente active su cuenta aparecerá aquí, con su estado. Desde cada fila puedes desactivarlo, eliminarlo o consultar su historial de clases espejo.',
      },
      {
        selector: '#materias',
        titulo: 'Materias y asignaciones',
        texto:
          'Da de alta las materias y usa «Asignar» para vincular docente, materia y periodo. Sin esa asignación el docente no puede proponer una clase espejo.',
      },
      {
        selector: '#solicitudes',
        titulo: 'Revisa lo que llega',
        texto:
          'Las propuestas aparecen en este tablero. Si te toca revisarlas verás el botón «Revisar»: primero las revisa la institución de origen y después la de destino. Al aprobar como destino se crea la clase espejo, y el motivo del rechazo es obligatorio.',
      },
      {
        selector: CAMPANA,
        titulo: 'Tu aviso diario',
        texto:
          'La campana reúne lo que está pendiente en esta pantalla, y el calendario los vencimientos y las sesiones próximas. Ahí te avisa si una solicitud está a punto de caducar.',
      },
      {
        selector: '#proyectos',
        titulo: 'Las clases espejo de tu institución',
        texto:
          'Aquí sigues su avance. Puedes consultarlas y sumar docentes de tu institución, pero la clase la organizan los docentes: planificación, sesiones, evidencias y evaluación.',
      },
      {
        titulo: '¡Eso es todo!',
        texto:
          'Con invitar docentes, asignar materias y revisar solicitudes ya tienes lo esencial. Puedes repetir esta guía desde «Ayuda».',
      },
    ],
  },

  {
    id: 'inicio',
    titulo: 'Inicio',
    resumen: 'Tu panel: los indicadores, lo que espera revisión y por dónde empezar.',
    pasos: [
      {
        selector: '.welcome',
        titulo: 'Este es tu panel',
        texto:
          'Tu nombre, tu institución y cuatro indicadores: docentes, materias, asignaciones y «Por revisar», que son las solicitudes que esperan tu decisión.',
      },
      {
        selector: '.welcome-action',
        titulo: 'Tu acción más frecuente',
        texto:
          '«Invitar docente» está siempre a mano. El docente recibe un correo y activa su cuenta él mismo.',
      },
      {
        selector: '#recordatorios',
        titulo: 'Lo que viene y lo que te toca',
        texto:
          'Lo próximo y lo que está por responder. Si alguna solicitud caducó por falta de respuesta, aquí te avisa y te dice cuántas.',
      },
      {
        boton: 'Ver calendario',
        titulo: 'El mes, de un vistazo',
        texto:
          'Abre el calendario para ver juntos los vencimientos de revisión, las clases y las sesiones programadas.',
      },
      {
        selector: CAMPANA,
        titulo: 'Tu aviso diario',
        texto:
          'La campana junta los pendientes de la pantalla y te baja a la sección al pulsarlo.',
      },
      {
        selector: '#comunidad',
        titulo: 'La comunidad CACE',
        texto:
          'Los países que forman la red. Las instituciones de estos países pueden proponerte clases espejo.',
      },
    ],
  },

  {
    id: 'institucion',
    titulo: 'Mi institución',
    resumen: 'Los datos que ven las otras instituciones al recibir tus propuestas.',
    pasos: [
      {
        selector: '#institucion',
        titulo: 'Mi institución',
        texto:
          'Estos datos son los que verán las otras instituciones cuando reciban tus propuestas, y los que salen en los enlaces de invitación.',
      },
      {
        selector: 'section.card:has(#institucion) .btn',
        titulo: 'Para cambiarlos, «Editar»',
        texto:
          'Se abre el formulario con el nombre, el país (de ahí sale la bandera), el estado, la ciudad y el contacto institucional.',
      },
      {
        titulo: 'Mientras esté incompleta, el panel te lo recuerda',
        texto:
          'Hasta que completes los datos obligatorios, tu institución no aparece como destino posible para las demás y el panel te lo avisa en el inicio.',
      },
    ],
  },

  {
    id: 'docentes',
    titulo: 'Docentes',
    resumen: 'Invitar docentes y qué puedes hacer con cada uno.',
    pasos: [
      {
        accion: 'abrir-invitacion',
        selector: '#d-correo',
        titulo: 'Invita desde aquí',
        texto:
          'Se abre un formulario con dos datos: el correo del docente y su número de empleado. Le llega un correo con un enlace que solo puede usar una vez.',
      },
      {
        accion: 'cerrar-invitacion',
        selector: '#docentes',
        titulo: 'Quiénes son tus docentes',
        texto:
          'Aparecen aquí con su estado: «Desactivado» mientras no active su cuenta desde el correo, y «Activo» después.',
      },
      {
        boton: 'Historial',
        titulo: 'El historial de un docente',
        texto:
          'Desde cada fila consultas sus clases espejo: cuántas ha hecho, con quién y en qué estado.',
      },
      {
        boton: 'Desactivar',
        titulo: 'Desactivar, activar o eliminar',
        texto:
          'Desactivar le quita el acceso sin borrar su historial (útil si está de licencia). «Eliminar» solo funciona si no tiene clases ni firmas: el sistema protege el historial y te dirá por qué no puede.',
      },
    ],
  },

  {
    id: 'materias',
    titulo: 'Materias',
    resumen: 'Dar de alta materias y asignarlas a un docente por periodo.',
    pasos: [
      {
        selector: '#materias',
        titulo: 'Materias',
        texto:
          'El catálogo de materias de tu institución, con sus docentes asignados y el periodo de cada asignación.',
      },
      {
        selector: 'section.card:has(#materias) .collapse-toggle',
        titulo: 'Ábrela para ver el detalle',
        texto:
          'Esta sección arranca contraída. Pulsa la flecha: verás cada materia con sus asignaciones. (Si no la abres, me salto los pasos que apuntan dentro.)',
      },
      {
        boton: 'Nueva materia',
        titulo: 'Da de alta una materia',
        texto:
          'La clave, el nombre, el programa educativo y una descripción. Con eso ya puedes asignarla.',
      },
      {
        boton: 'Asignar',
        titulo: 'Asigna docente y periodo',
        texto:
          'Aquí se vincula un docente con esta materia en un periodo escolar. Sin esa asignación, el docente no puede proponer una clase espejo: es el requisito que más se olvida.',
      },
    ],
  },

  {
    id: 'solicitudes',
    titulo: 'Solicitudes',
    resumen: 'Revisar lo que proponen otras instituciones y sus plazos.',
    pasos: [
      {
        selector: '#solicitudes',
        titulo: 'Lo que llega',
        texto:
          'Cada fila trae la institución de origen, la materia, la fecha propuesta y su estado. La revisión es doble: primero la institución de origen y después la de destino.',
      },
      {
        boton: 'Revisar',
        titulo: 'Si te toca revisarla',
        texto:
          'El botón «Revisar» solo aparece cuando es el turno de tu institución; verás entre paréntesis si te toca como origen o como destino.',
      },
      {
        titulo: 'Aprobar crea la clase; rechazar exige motivo',
        texto:
          'Al revisar eliges aprobar o rechazar. Si apruebas como institución de destino, la clase espejo se crea al instante y aparece en «Proyectos de clase espejo». Si rechazas, el motivo es obligatorio y el docente lo verá para corregir.',
      },
      {
        titulo: 'Los plazos corren solos',
        texto:
          'Cada solicitud trae su fecha límite y una marca de urgencia: próxima, crítica o vencida. Si nadie responde a tiempo, se caduca y se cancela sola, así que conviene mirar el calendario de vez en cuando.',
      },
    ],
  },

  {
    id: 'proyectos',
    titulo: 'Clases espejo',
    resumen: 'Las clases de tu institución: qué puedes hacer y qué no.',
    pasos: [
      {
        selector: '#proyectos',
        titulo: 'Las clases espejo de tu institución',
        texto:
          'Aquí sigues su avance: en qué punto está cada una y quiénes participan.',
      },
      {
        boton: 'Abrir',
        titulo: 'Míralas por dentro',
        texto:
          'Dentro ves la planificación conjunta, las sesiones, las evidencias y la evaluación final.',
      },
      {
        titulo: 'Lo que sí y lo que no',
        texto:
          'Puedes sumar docentes de tu institución y firmar el acta de supervisión. La planificación, los reportes de clase y las evidencias son de los docentes: tú los acompañas, no los reemplazas.',
      },
      {
        titulo: 'Pide ayuda otra vez dentro',
        texto:
          'Cuando estés dentro de una clase espejo, abre «Ayuda» de nuevo: te explico esa pantalla apartado por apartado.',
      },
    ],
  },

  {
    id: 'calendario',
    titulo: 'Calendario',
    resumen: 'El mes completo: vencimientos de revisión, clases y sesiones.',
    pasos: [
      {
        selector: CAMPANA,
        titulo: 'Lo urgente, primero',
        texto:
          'La campana muestra lo pendiente de esta pantalla, con los avisos de lo que está por vencer.',
      },
      {
        accion: 'abrir-calendario',
        selector: '.calendario-grid',
        titulo: 'El mes entero',
        texto:
          'Cada día con algo tiene su punto: solicitudes por revisar que vencen, clases y sesiones. Pulsa un día para ver el detalle.',
      },
      {
        selector: '.calendario-lado',
        titulo: 'El detalle del día',
        texto:
          'A un lado tienes la lista de lo de ese día con su urgencia. Desde ahí puedes ir directo a la solicitud o a la clase.',
      },
      {
        titulo: 'Cierra cuando termines',
        texto:
          'Con la tecla Esc o con la ✕ vuelves a tu panel. La guía se cierra contigo.',
      },
    ],
  },

  {
    id: 'comunidad',
    titulo: 'Comunidad',
    resumen: 'Los países y las instituciones que forman la red CACE.',
    pasos: [
      {
        selector: '#comunidad',
        titulo: 'La comunidad CACE',
        texto:
          'Los países que forman la Comunidad de Apoyo a Clases Espejo. Con sus instituciones puedes acordar clases espejo.',
      },
      {
        titulo: 'Completa tu institución para aparecer',
        texto:
          'Si tus datos están incompletos, las otras instituciones no te verán como destino. Se arregla en «Mi institución».',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// PRESIDENCIA DE LA CACE
// ---------------------------------------------------------------------------

/**
 * Recorridos de la pantalla de la presidencia de la CACE.
 *
 * Son dos, como el menú lateral: el panel (Inicio) y la lista de instituciones,
 * que es donde está todo el trabajo. No se reutilizan los recorridos de docente
 * ni de agente porque hablan de solicitudes, materias y clases espejo, que la
 * CACE no toca.
 */
export const GUIA_CACE: GuiaSeccion[] = [
  {
    id: 'inicio',
    titulo: 'Inicio',
    resumen: 'Tu panel: qué instituciones esperan tu decisión y por dónde empezar.',
    pasos: [
      {
        selector: '#cabecera',
        titulo: 'Este es tu panel',
        texto:
          'Aquí tienes tu nombre y, si entraste con la contraseña provisional, el formulario para cambiarla: hasta que lo hagas no se abre el resto del panel.',
      },
      {
        selector: CAMPANA,
        titulo: 'Tu aviso diario',
        texto:
          'La campana reúne lo que espera tu decisión en esta pantalla y te baja a la sección al pulsarlo.',
      },
      {
        selector: '#instituciones',
        titulo: 'Instituciones',
        texto:
          'La lista completa: primero las pendientes, y después las aprobadas, rechazadas y vetadas.',
      },
      {
        selector: '#personalizacion',
        titulo: 'Personalización',
        texto:
          'Aquí cambias el logo, los textos y el tema de la CACE. Lo que guardes se ve en toda la aplicación, incluida la pantalla de acceso.',
      },
      {
        titulo: 'Cuando quieras seguir',
        texto:
          'En el menú lateral tienes «Instituciones», «Personalización», «Comunidad» y «Premios», y «Ayuda» vuelve a abrir esta ventana cuando la necesites.',
      },
    ],
  },
  {
    id: 'instituciones',
    titulo: 'Instituciones',
    resumen: 'Aprobar, rechazar, vetar y reactivar las instituciones que se registran.',
    pasos: [
      {
        selector: '#instituciones',
        titulo: 'Las instituciones',
        texto:
          'Cada ficha trae el país, el agente de contacto y su estado ante la CACE. Las pendientes aparecen siempre primero.',
      },
      {
        boton: 'Aprobar',
        titulo: 'Aprobar',
        texto:
          'Deja operar a la institución con normalidad: sus agentes ya pueden invitar docentes y proponer clases espejo.',
      },
      {
        boton: 'Rechazar',
        titulo: 'Rechazar y vetar',
        texto:
          'Las dos decisiones duras exigen un motivo, y el agente de la institución lo recibe por correo. El veto es más grave: esa institución no puede volver a proponer clases.',
      },
      {
        boton: 'Reactivar',
        titulo: 'Rectificar',
        texto:
          'Si una institución rechazada o vetada lo arregla, «Reactivar» la devuelve al juego. Una rechazada sin historia también se puede borrar definitivamente.',
      },
      {
        titulo: 'Cada decisión queda firmada',
        texto:
          'La ficha guarda quién la revisó y cuándo («Revisada por …»): así la CACE puede responder por sus decisiones.',
      },
    ],
  },
  {
    id: 'personalizacion',
    titulo: 'Personalización',
    resumen: 'Lema, descripción, tema de color y logo de la CACE.',
    pasos: [
      {
        selector: '#personalizacion',
        titulo: 'La identidad de la CACE',
        texto:
          'El lema y la descripción salen en la portada del acceso y en la sección «Comunidad» de docentes y agentes. El logo se usa en la barra superior y en el acceso.',
      },
      {
        selector: '#personalizacion-temas',
        titulo: 'Temas, no color libre',
        texto:
          'Eliges entre cuatro temas ya probados. Un color libre rompería el contraste y dejaría texto ilegible sobre el fondo; con temas cerrados eso no puede pasar.',
      },
      {
        selector: '#personalizacion-vista',
        titulo: 'Vista previa',
        texto:
          'Antes de guardar ves cómo queda el tema elegido, con sus botones y sus tarjetas, sin cambiar el resto de la aplicación.',
      },
    ],
  },
  {
    id: 'comunidad',
    titulo: 'Comunidad',
    resumen: 'Las banderas de los países que forman la comunidad CACE.',
    pasos: [
      {
        selector: '#comunidad',
        titulo: 'Los países de la comunidad',
        texto:
          'Son los que aparecen como banderas en la sección «Comunidad» de docentes y agentes. El orden de esta lista es el que se ve allí.',
      },
      {
        boton: 'Añadir país',
        titulo: 'Añadir un país',
        texto:
          'Basta el código ISO de dos letras (por ejemplo PT) y el nombre: la bandera se arma sola con el código.',
      },
      {
        titulo: 'Desactivar antes que borrar',
        texto:
          'Si un país deja la comunidad, desactívalo: desaparece de la web pero se queda en la lista, y volver a activarlo es un clic. Borrar solo hace falta si fue un error.',
      },
    ],
  },
  {
    id: 'premios',
    titulo: 'Premios',
    resumen: 'Premios y reconocimientos: se preparan aquí y se publican cuando toca.',
    pasos: [
      {
        selector: '#premios',
        titulo: 'Premios y reconocimientos',
        texto:
          'Cada premio guarda el título, el año, a quién se le otorgó y, si quieres, la institución y una imagen.',
      },
      {
        boton: 'Guardar premio',
        titulo: 'Borrador o publicado',
        texto:
          'Mientras no lo marques como publicado, el premio solo lo ves tú aquí: no sale ni en la sección «Comunidad» ni en la portada del acceso.',
      },
      {
        titulo: 'La imagen es opcional',
        texto:
          'Para subir la imagen primero hay que guardar el premio: se añade desde su ficha, en la lista. Una imagen se ve mejor en la sección pública.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// CLASE ESPEJO (la pantalla de un proyecto, para los dos roles)
// ---------------------------------------------------------------------------

/**
 * Recorrido de la pantalla de una clase espejo. Cambia en dos pasos según el
 * rol: el docente confirma su participación y el agente firma el acta.
 */
export function guiaProyecto(rol: 'DOCENTE' | 'AGENTE'): GuiaSeccion {
  const pasos: PasoGuia[] = [
    {
      selector: '.welcome',
      titulo: 'Esta es tu clase espejo',
      texto:
        'Arriba están el título, las dos instituciones y las fechas de inicio y fin. El estado te dice en qué punto va.',
    },
    {
      boton: 'Descargar resumen',
      titulo: 'Llévate el resumen',
      texto:
        'Descarga el resumen de la clase en PDF: título, instituciones, docentes, planificación y estado. Va bien para el expediente o para tu informe.',
    },
    {
      selector: '#datos',
      titulo: 'Datos del proyecto',
      texto:
        'Las fechas, la plataforma acordada y el estado. Si algo no cuadra, aquí es donde se ve.',
    },
    {
      selector: '#participantes',
      titulo: 'Docentes participantes',
      texto:
        'Los docentes de las dos instituciones. Cada uno confirma su participación por separado.',
    },
    {
      selector: '#planificacion',
      titulo: 'Planificación conjunta',
      texto:
        'El corazón de la clase: objetivos, temas, metodología y plataforma. La llenan los docentes de común acuerdo y después cada uno la confirma.',
    },
    {
      selector: '#sesiones',
      titulo: 'Sesiones',
      texto:
        'Cada sesión se programa con su fecha y su enlace. Al terminar se captura el reporte de clase y cada docente lo firma: si alguien cambia el texto, las firmas se reinician.',
    },
    {
      selector: '#actividades',
      titulo: 'Actividades',
      texto:
        'Lo que tienen que hacer los estudiantes, con su fecha límite. Sirve de guía para las dos instituciones.',
    },
    {
      selector: '#evidencias',
      titulo: 'Evidencias',
      texto:
        'Los archivos y fotos que demuestran lo que pasó. Quedan guardados en la clase y son la prueba para el cierre.',
    },
    {
      selector: '#evaluacion',
      titulo: 'Evaluación final',
      texto:
        'Cómo salió la experiencia: resultados y observaciones. Es uno de los requisitos para poder cerrar.',
    },
    {
      selector: '#cierre',
      titulo: 'Cierre de la clase espejo',
      texto:
        'Cuando ya hay evaluación final y todos los reportes están confirmados, la clase se cierra aquí y queda como historial.',
    },
  ];

  if (rol === 'DOCENTE') {
    pasos.splice(4, 0, {
      boton: 'Confirmar mi participación',
      titulo: 'Confirma tu participación',
      texto:
        'Mientras no confirmes, la clase no avanza. Es tu forma de decir «cuento con ello»; el otro docente hace lo mismo desde su institución.',
    });

    // La lista de alumnos solo la ve el docente: de ahí salen los certificados.
    pasos.splice(pasos.length - 1, 0, {
      selector: '#alumnos',
      titulo: 'La lista de tus alumnos',
      texto:
        'Aquí subes a tus alumnos: con un archivo de Excel, un CSV o pegando los nombres. La plataforma los lee, te avisa de los repetidos o mal escritos y te deja corregirlos antes de guardar. Con esa lista se emitirán los certificados cuando la clase se cierre.',
    });
  } else {
    pasos.splice(4, 0, {
      titulo: 'Tu parte: acompañar y firmar el acta',
      texto:
        'Puedes sumar docentes de tu institución a esta clase y firmar el acta de supervisión. Lo demás lo llevan los docentes.',
    });
  }

  return {
    id: 'proyecto',
    titulo: 'Esta clase espejo',
    resumen: 'La pantalla completa de la clase: planificación, sesiones y cierre.',
    pasos,
  };
}
