import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
        : undefined,
    });
  }

  /**
   * Envía la invitación al docente. La URL pública llega desde fuera (la
   * resuelve `common/url-publica.ts` a partir de la petición) para que el enlace
   * funcione igual en local, con un túnel o con un dominio propio.
   */
  async sendInvitation(
    to: string,
    token: string,
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/activate?token=${token}`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: 'Invitación a Clases Espejo - Activa tu cuenta',
      text: `Activa tu cuenta haciendo clic en el siguiente enlace: ${link}`,
      html: `
        <p>Has sido invitado a la plataforma <strong>Clases Espejo</strong>.</p>
        <p>Haz clic en el siguiente enlace para activar tu cuenta y establecer tu contraseña:</p>
        <p><a href="${link}">${link}</a></p>
      `,
    });
  }

  /**
   * Envía al presidente de la CACE sus datos de acceso. A diferencia de la
   * invitación, la cuenta ya existe (la crea el propio servidor al arrancar):
   * aquí no hay token de activación, sino una contraseña provisional que el
   * sistema obligará a cambiar en el primer acceso.
   */
  async sendCredencialesPresidente(
    to: string,
    password: string,
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/login`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: 'Acceso a Clases Espejo - Presidencia de la CACE',
      text: `Se creó tu cuenta de presidencia de la CACE. Correo: ${to} · Contraseña provisional: ${password} · Entra en: ${link} · Por seguridad, el sistema te pedirá cambiar la contraseña en el primer acceso.`,
      html: `
        <p>Se creó tu cuenta de <strong>presidencia de la CACE</strong> en la plataforma <strong>Clases Espejo</strong>.</p>
        <p><strong>Correo:</strong> ${to}<br />
        <strong>Contraseña provisional:</strong> ${password}</p>
        <p>Entra en <a href="${link}">${link}</a>.</p>
        <p>Por seguridad, el sistema te pedirá cambiar la contraseña en el primer acceso.</p>
      `,
    });
  }

  /**
   * Envía a una secretaría de la CACE sus datos de acceso. Es el mismo caso que
   * el del presidente: la cuenta la crea el presidente desde su panel, con
   * contraseña provisional y cambio obligatorio en el primer acceso, así que no
   * hay token de activación que mandar.
   */
  async sendCredencialesSecretaria(
    to: string,
    password: string,
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/login`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: 'Acceso a Clases Espejo - Secretaría de la CACE',
      text: `Se creó tu cuenta de secretaría de la CACE. Correo: ${to} · Contraseña provisional: ${password} · Entra en: ${link} · Por seguridad, el sistema te pedirá cambiar la contraseña en el primer acceso.`,
      html: `
        <p>Se creó tu cuenta de <strong>secretaría de la CACE</strong> en la plataforma <strong>Clases Espejo</strong>.</p>
        <p><strong>Correo:</strong> ${to}<br />
        <strong>Contraseña provisional:</strong> ${password}</p>
        <p>Entra en <a href="${link}">${link}</a>.</p>
        <p>Desde tu panel podrás personalizar la CACE (logo, textos, tema y banderas), publicar premios y <strong>pedir</strong> el borrado definitivo de una institución rechazada; el borrado lo autoriza la presidencia.</p>
        <p>Por seguridad, el sistema te pedirá cambiar la contraseña en el primer acceso.</p>
      `,
    });
  }

  /**
   * Avisa a quien **recibe** la presidencia de la CACE.
   *
   * La presidencia no se borra ni se desactiva: se transmite. Quien entra tiene
   * que enterarse de que el cargo cambió de manos y de que quien lo deja **no se
   * va**: queda como suplente, con las mismas capacidades.
   *
   * Si la cuenta es nueva, este mismo aviso lleva dentro las credenciales
   * provisionales. En este flujo no hay token de activación que mandar (la
   * cuenta la crea el presidente que transmite), así que se reutiliza el mismo
   * patrón del alta de secretarías: contraseña provisional y cambio obligatorio
   * en el primer acceso.
   */
  async sendCambioPresidenciaEntrante(
    to: string,
    datos: {
      nombreEntrante: string;
      nombreSaliente: string;
      /** Solo cuando la cuenta es nueva (o no tenía contraseña). */
      password?: string;
      motivo: string;
    },
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/login`;
    const credenciales = datos.password
      ? `\n\nCorreo: ${to} · Contraseña provisional: ${datos.password}. Por seguridad, el sistema te pedirá cambiarla en el primer acceso.`
      : '';

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: 'Clases Espejo - Ahora presides la CACE',
      text: `${datos.nombreSaliente} te transmitió la presidencia de la CACE: desde ahora el cargo es tuyo. ${datos.nombreSaliente} queda como suplente, sigue activo y conserva las capacidades.${datos.motivo ? ` Motivo: ${datos.motivo}.` : ''}${credenciales}\n\nEntra en: ${link}`,
      html: `
        <p><strong>${datos.nombreSaliente}</strong> te transmitió la <strong>presidencia de la CACE</strong>: desde ahora el cargo es tuyo.</p>
        <p>${datos.nombreSaliente} queda como <strong>suplente</strong>, sigue activo y conserva las capacidades, así que no se pierde nada por el camino.</p>
        ${datos.motivo ? `<p><strong>Motivo:</strong> ${datos.motivo}</p>` : ''}
        ${
          datos.password
            ? `<p><strong>Correo:</strong> ${to}<br /><strong>Contraseña provisional:</strong> ${datos.password}</p>
               <p>Por seguridad, el sistema te pedirá cambiar la contraseña en el primer acceso.</p>`
            : ''
        }
        <p>Entra en <a href="${link}">${link}</a>.</p>
      `,
    });
  }

  /**
   * Avisa a quien **deja** la presidencia: la transmitió, no la perdió. Su
   * cuenta sigue activa como suplente, con las mismas capacidades.
   */
  async sendCambioPresidenciaSaliente(
    to: string,
    datos: { nombreEntrante: string; nombreSaliente: string; motivo: string },
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/cace`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: 'Clases Espejo - Transmitiste la presidencia de la CACE',
      text: `${datos.nombreEntrante} es desde ahora la presidencia de la CACE. Tú quedas como suplente: tu cuenta sigue activa y conservas las mismas capacidades, así que puedes seguir entrando al panel.${datos.motivo ? ` Motivo del cambio: ${datos.motivo}.` : ''} Entra en: ${link}`,
      html: `
        <p><strong>${datos.nombreEntrante}</strong> es desde ahora la <strong>presidencia de la CACE</strong>.</p>
        <p>Tú quedas como <strong>suplente</strong>: tu cuenta sigue activa y conservas las mismas capacidades, así que puedes seguir entrando al panel con normalidad.</p>
        ${datos.motivo ? `<p><strong>Motivo del cambio:</strong> ${datos.motivo}</p>` : ''}
        <p>Entra en <a href="${link}">${link}</a>.</p>
      `,
    });
  }

  /**
   * Avisa al agente de que la CACE aprobó su institución: ya puede proponer y
   * recibir clases espejo.
   */
  async sendInstitucionAprobada(
    to: string,
    institucion: string,
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/agente`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: 'Clases Espejo - Tu institución fue aprobada por la CACE',
      text: `La CACE aprobó el registro de ${institucion}. Ya puedes proponer y recibir clases espejo. Entra en: ${link}`,
      html: `
        <p>La <strong>CACE</strong> aprobó el registro de <strong>${institucion}</strong>.</p>
        <p>Desde ahora tu institución puede proponer y recibir clases espejo.</p>
        <p>Entra en <a href="${link}">${link}</a> para continuar.</p>
      `,
    });
  }

  /**
   * Avisa del rechazo con el motivo: el registro se conserva y el agente puede
   * corregir lo que se le señala.
   */
  async sendInstitucionRechazada(
    to: string,
    institucion: string,
    motivo: string,
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/agente`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject:
        'Clases Espejo - Registro de tu institución rechazado por la CACE',
      text: `La CACE rechazó el registro de ${institucion}. Motivo: ${motivo}. Puedes corregir los datos de tu institución desde: ${link}`,
      html: `
        <p>La <strong>CACE</strong> rechazó el registro de <strong>${institucion}</strong>.</p>
        <p><strong>Motivo:</strong> ${motivo}</p>
        <p>El registro se conserva: entra en <a href="${link}">${link}</a> para corregir los datos de tu institución.</p>
      `,
    });
  }

  /**
   * Avisa del veto. No es un aviso público: solo lo recibe la institución
   * afectada, y sus clases en curso siguen vivas.
   */
  async sendInstitucionVetada(
    to: string,
    institucion: string,
    motivo: string,
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/login`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: 'Clases Espejo - Tu institución fue vetada por la CACE',
      text: `La CACE vetó a ${institucion}. Motivo: ${motivo}. No podrá proponer ni recibir clases espejo nuevas; las clases en curso siguen su curso. Entra en: ${link}`,
      html: `
        <p>La <strong>CACE</strong> vetó a <strong>${institucion}</strong>.</p>
        <p><strong>Motivo:</strong> ${motivo}</p>
        <p>No podrá proponer ni recibir clases espejo nuevas. Las clases que ya están en curso siguen su curso con normalidad.</p>
        <p>Entra en <a href="${link}">${link}</a>.</p>
      `,
    });
  }

  /**
   * Avisa a los agentes de una institución ya aprobada de que alguien se acaba
   * de registrar queriendo unirse a ella: el alta la confirman ellos, no el
   * presidente.
   */
  async sendAltaAgentePendiente(
    to: string,
    institucion: string,
    agente: string,
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/agente`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: `Clases Espejo - ${agente} quiere unirse a tu institución`,
      text: `${agente} se registró como agente de internacionalización y eligió ${institucion}. Su alta la confirmas tú (o cualquier agente de la institución) desde: ${link}`,
      html: `
        <p><strong>${agente}</strong> se registró como agente de internacionalización y eligió <strong>${institucion}</strong>.</p>
        <p>Su alta la confirma un agente de la institución, no la CACE. Hasta que la confirmes, esa persona solo puede completar los datos de la institución.</p>
        <p>Entra en <a href="${link}">${link}</a> para confirmarla o rechazarla.</p>
      `,
    });
  }

  /** Avisa al agente nuevo de que su alta en la institución quedó confirmada. */
  async sendAltaAgenteConfirmada(
    to: string,
    institucion: string,
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/agente`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: 'Clases Espejo - Tu alta como agente fue confirmada',
      text: `Un agente de ${institucion} confirmó tu alta: ya puedes usar el panel completo. Entra en: ${link}`,
      html: `
        <p>Un agente de <strong>${institucion}</strong> confirmó tu alta como agente de internacionalización.</p>
        <p>Desde ahora puedes invitar docentes, crear materias y asignaciones, y proponer clases espejo.</p>
        <p>Entra en <a href="${link}">${link}</a> para continuar.</p>
      `,
    });
  }

  /**
   * Avisa de que el alta fue rechazada. La cuenta queda desactivada, así que el
   * correo es lo único que explica por qué no puede entrar.
   */
  async sendAltaAgenteRechazada(
    to: string,
    institucion: string,
    motivo: string,
    urlPublica: string,
  ): Promise<void> {
    const link = `${urlPublica}/login`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: 'Clases Espejo - Tu alta como agente no fue aceptada',
      text: `Un agente de ${institucion} no aceptó tu alta como agente de internacionalización.${motivo ? ` Motivo: ${motivo}.` : ''} Tu cuenta quedó desactivada.`,
      html: `
        <p>Un agente de <strong>${institucion}</strong> no aceptó tu alta como agente de internacionalización.</p>
        ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
        <p>Tu cuenta quedó desactivada, así que no podrás entrar en <a href="${link}">${link}</a>. Si crees que es un error, ponte en contacto con la institución.</p>
      `,
    });
  }

  /**
   * Envía al alumno su certificado: el PDF adjunto y el enlace de verificación.
   *
   * Va en un solo correo y con el PDF dentro porque el alumno **no tiene cuenta**
   * en la plataforma: si el correo solo llevara un enlace de descarga, haría
   * falta una sesión que no tiene. El enlace de verificación sí lo puede abrir
   * cualquiera (es la misma página del QR, con su código), y es lo que le permite
   * comprobar que el documento es auténtico.
   *
   * Los datos del certificado llegan en un objeto y no como argumentos sueltos
   * porque son siete: en una lista posicional, cambiar el orden de dos de ellos
   * mandaría el folio donde va el nombre sin que nadie se enterara.
   */
  async sendCertificadoAlumno(
    to: string,
    datos: {
      /** Nombre del alumno, tal como sale impreso. */
      alumno: string;
      /** Título de la clase espejo. */
      titulo: string;
      folio: string;
      /** Las dos instituciones, ya juntas («A (México) · B (Colombia)»). */
      instituciones: string;
      /** Enlace de verificación pública, con su código. */
      enlaceVerificacion: string;
      pdf: Buffer;
      nombreArchivo: string;
    },
  ): Promise<void> {
    const {
      alumno,
      titulo,
      folio,
      instituciones,
      enlaceVerificacion,
      pdf,
      nombreArchivo,
    } = datos;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: `Clases Espejo - Tu certificado de «${titulo}» (${folio})`,
      text: `Hola ${alumno}: te adjuntamos el certificado de la clase espejo «${titulo}», que emitieron ${instituciones}. Folio: ${folio}. Puedes comprobar que es auténtico en: ${enlaceVerificacion} (no hace falta crear ninguna cuenta).`,
      html: `
        <p>Hola <strong>${alumno}</strong>:</p>
        <p>Te adjuntamos el certificado de la clase espejo <strong>«${titulo}»</strong>, emitido por la CACE con la participación de ${instituciones}.</p>
        <p><strong>Folio:</strong> ${folio}</p>
        <p>Puedes comprobar que el certificado es auténtico —y ver su estado— en <a href="${enlaceVerificacion}">${enlaceVerificacion}</a>. No hace falta crear ninguna cuenta: el enlace abre la página de verificación directamente.</p>
        <p>El certificado va adjunto en este correo en PDF.</p>
      `,
      attachments: [
        {
          filename: nombreArchivo,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * Envía el calendario de una clase espejo a un docente participante: el
   * archivo `.ics` va adjunto (no como enlace) para que funcione aunque el
   * docente abra el correo en otro equipo.
   *
   * El texto dice **quién pone los recordatorios** porque es la duda que
   * aparece siempre: la plataforma no manda avisos ni notificaciones; el
   * archivo trae tres `VALARM` por evento (1 hora, 30 y 15 minutos) y quien
   * avisa es el calendario de cada quien al importarlo. También se avisa de que
   * volver a importar el archivo **actualiza** los eventos en vez de
   * duplicarlos (el `UID` es estable), que es lo que evita que la segunda
   * sesión aparezca dos veces.
   *
   * El archivo se entrega con su `Content-Type` real (`text/calendar`): algunos
   * clientes de correo deciden con esa cabecera si abrirlo con el calendario o
   * guardarlo como un archivo cualquiera.
   */
  async sendCalendarioClase(
    to: string,
    datos: {
      /** Nombre de quien recibe el correo (docente participante). */
      destinatario: string;
      /** Título de la clase espejo. */
      titulo: string;
      /** Las dos instituciones, ya juntas («A (México) · B (Colombia)»). */
      instituciones: string;
      /** Cuántas sesiones lleva el archivo, para poder decirlo en el texto. */
      sesiones: number;
      /** Contenido del `.ics`, ya generado. */
      archivo: Buffer;
      nombreArchivo: string;
    },
  ): Promise<void> {
    const {
      destinatario,
      titulo,
      instituciones,
      sesiones,
      archivo,
      nombreArchivo,
    } = datos;

    const cuantas = sesiones === 1 ? 'una sesión' : `${sesiones} sesiones`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'no-reply@clasesespejo.local',
      to,
      subject: `Clases Espejo - Calendario de «${titulo}»`,
      text: `Hola ${destinatario}: te adjuntamos el calendario de la clase espejo «${titulo}» (${instituciones}), con ${cuantas}. Ábrelo con tu calendario (Google, Outlook, Apple…) para añadir las sesiones. Los recordatorios los pone tu calendario: el archivo ya trae avisos 1 hora, 30 minutos y 15 minutos antes de cada sesión, y la plataforma no envía recordatorios ni notificaciones. Si vuelves a importar el mismo archivo más adelante, se actualizan los mismos eventos en vez de duplicarse.`,
      html: `
        <p>Hola <strong>${destinatario}</strong>:</p>
        <p>Te adjuntamos el calendario de la clase espejo <strong>«${titulo}»</strong> (${instituciones}), con ${cuantas}.</p>
        <p>Abre el archivo con tu calendario (Google, Outlook, Apple…) para añadir las sesiones.</p>
        <p><strong>Los recordatorios los pone tu calendario, no la plataforma.</strong> El archivo ya trae avisos <strong>1 hora, 30 minutos y 15 minutos</strong> antes de cada sesión. La plataforma no envía recordatorios ni notificaciones: el aviso lo da el calendario de cada quien al importarlo.</p>
        <p>Si vuelves a importar el mismo archivo más adelante, se actualizan los mismos eventos en vez de duplicarse.</p>
        <p>El calendario va adjunto en este correo.</p>
      `,
      attachments: [
        {
          filename: nombreArchivo,
          content: archivo,
          contentType: 'text/calendar; charset=utf-8',
        },
      ],
    });
  }
}
