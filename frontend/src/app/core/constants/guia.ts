/**
 * Guía interactiva de primeros pasos.
 *
 * Cada paso resalta un elemento real de la pantalla (`selector`) o, si no lleva,
 * sale como panel centrado para explicar algo que no está a la vista.
 *
 * `accion` permite pedirle a la pantalla que abra o cierre un formulario, así la
 * guía puede señalar campos que solo existen dentro de una ventana.
 */
export interface PasoGuia {
  /** Selector CSS del elemento a resaltar. */
  selector?: string;
  titulo: string;
  texto: string;
  /** Acción que la pantalla debe ejecutar al entrar en el paso. */
  accion?:
    | 'abrir-solicitud'
    | 'cerrar-solicitud'
    | 'abrir-invitacion'
    | 'cerrar-invitacion';
}

/** Recorrido del docente: de proponer la clase hasta verla aprobada. */
export const GUIA_DOCENTE: PasoGuia[] = [
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
    selector: '.navbar-icon',
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
];

/** Recorrido del agente: preparar la institución, invitar y revisar una solicitud. */
export const GUIA_AGENTE: PasoGuia[] = [
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
      'Los docentes no se registran solos: tú los invitas y ellos activan su cuenta desde el correo. Se abre un formulario con dos datos: su correo y su número de empleado.',
  },
  {
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
    selector: '.navbar-icon',
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
];
