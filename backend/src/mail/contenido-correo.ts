/**
 * Texto y HTML de los correos que se **encolan** (Fase 2).
 *
 * Antes el contenido se armaba dentro de `MailService.send…`, es decir, en el
 * mismo momento de enviarlo. La cola necesita el correo ya escrito para guardarlo
 * en `ENVIO_CORREO` y mandarlo después, así que el contenido vive aparte: la
 * cola y el envío directo usan exactamente los mismos textos.
 */
export interface ContenidoCorreo {
  asunto: string;
  texto: string;
  html: string;
}

export interface DatosCertificado {
  /** Nombre del alumno, tal como sale impreso. */
  alumno: string;
  /** Título de la clase espejo. */
  titulo: string;
  folio: string;
  /** Las dos instituciones, ya juntas («A (México) · B (Colombia)»). */
  instituciones: string;
  /** Enlace de verificación pública, con su código. */
  enlaceVerificacion: string;
}

/** Correo del certificado de un alumno (el PDF va como adjunto aparte). */
export function contenidoCertificadoAlumno(
  datos: DatosCertificado,
): ContenidoCorreo {
  const { alumno, titulo, folio, instituciones, enlaceVerificacion } = datos;
  return {
    asunto: `Clases Espejo - Tu certificado de «${titulo}» (${folio})`,
    texto: `Hola ${alumno}: te adjuntamos el certificado de la clase espejo «${titulo}», que emitieron ${instituciones}. Folio: ${folio}. Puedes comprobar que es auténtico en: ${enlaceVerificacion} (no hace falta crear ninguna cuenta).`,
    html: `
        <p>Hola <strong>${alumno}</strong>:</p>
        <p>Te adjuntamos el certificado de la clase espejo <strong>«${titulo}»</strong>, emitido por la CACE con la participación de ${instituciones}.</p>
        <p><strong>Folio:</strong> ${folio}</p>
        <p>Puedes comprobar que el certificado es auténtico —y ver su estado— en <a href="${enlaceVerificacion}">${enlaceVerificacion}</a>. No hace falta crear ninguna cuenta: el enlace abre la página de verificación directamente.</p>
        <p>El certificado va adjunto en este correo en PDF.</p>
      `,
  };
}

export interface DatosCalendario {
  /** Nombre de quien recibe el correo (docente participante). */
  destinatario: string;
  /** Título de la clase espejo. */
  titulo: string;
  /** Las dos instituciones, ya juntas («A (México) · B (Colombia)»). */
  instituciones: string;
  /** Cuántas sesiones lleva el archivo, para poder decirlo en el texto. */
  sesiones: number;
}

/**
 * Correo del calendario de una clase espejo (el `.ics` va como adjunto aparte).
 *
 * El texto dice **quién pone los recordatorios**: la plataforma no manda avisos;
 * el archivo trae tres `VALARM` por evento y avisa el calendario de cada quien.
 */
export function contenidoCalendarioClase(
  datos: DatosCalendario,
): ContenidoCorreo {
  const { destinatario, titulo, instituciones, sesiones } = datos;
  const cuantas = sesiones === 1 ? 'una sesión' : `${sesiones} sesiones`;
  return {
    asunto: `Clases Espejo - Calendario de «${titulo}»`,
    texto: `Hola ${destinatario}: te adjuntamos el calendario de la clase espejo «${titulo}» (${instituciones}), con ${cuantas}. Ábrelo con tu calendario (Google, Outlook, Apple…) para añadir las sesiones. Los recordatorios los pone tu calendario: el archivo ya trae avisos 1 hora, 30 minutos y 15 minutos antes de cada sesión, y la plataforma no envía recordatorios ni notificaciones. Si vuelves a importar el mismo archivo más adelante, se actualizan los mismos eventos en vez de duplicarse.`,
    html: `
        <p>Hola <strong>${destinatario}</strong>:</p>
        <p>Te adjuntamos el calendario de la clase espejo <strong>«${titulo}»</strong> (${instituciones}), con ${cuantas}.</p>
        <p>Abre el archivo con tu calendario (Google, Outlook, Apple…) para añadir las sesiones.</p>
        <p><strong>Los recordatorios los pone tu calendario, no la plataforma.</strong> El archivo ya trae avisos <strong>1 hora, 30 minutos y 15 minutos</strong> antes de cada sesión. La plataforma no envía recordatorios ni notificaciones: el aviso lo da el calendario de cada quien al importarlo.</p>
        <p>Si vuelves a importar el mismo archivo más adelante, se actualizan los mismos eventos en vez de duplicarse.</p>
        <p>El calendario va adjunto en este correo.</p>
      `,
  };
}

export interface DatosAvisoBloqueo {
  destinatario: string;
  minutos: number;
  enlaceRecuperacion: string;
}

/**
 * Aviso de bloqueo temporal por intentos fallidos.
 *
 * No se manda en cada intento (sería ruido y permitiría spamear a una persona);
 * solo cuando la cuenta queda bloqueada. El enlace de recuperación sirve para
 * desbloquearla sin esperar.
 */
export function contenidoAvisoBloqueo(
  datos: DatosAvisoBloqueo,
): ContenidoCorreo {
  const { destinatario, minutos, enlaceRecuperacion } = datos;
  return {
    asunto: 'Tu cuenta de Clases Espejo fue bloqueada temporalmente',
    texto: `Hola ${destinatario}: alguien intentó entrar a tu cuenta varias veces con una contraseña incorrecta y la bloqueamos durante ${minutos} minutos por seguridad. Si fuiste tú, espera o restablece tu contraseña en ${enlaceRecuperacion}. Si no fuiste tú, restablece tu contraseña ahora y avisa a la CACE. Nadie ha cambiado tu contraseña.`,
    html: `
        <p>Hola <strong>${destinatario}</strong>:</p>
        <p>Alguien intentó entrar a tu cuenta varias veces con una contraseña incorrecta y la bloqueamos durante <strong>${minutos} minutos</strong> por seguridad.</p>
        <p>Si fuiste tú, puedes esperar o <a href="${enlaceRecuperacion}">restablecer tu contraseña</a>.</p>
        <p>Si no fuiste tú, restablece tu contraseña ahora y avisa a la CACE. <strong>Nadie ha cambiado tu contraseña.</strong></p>
      `,
  };
}
