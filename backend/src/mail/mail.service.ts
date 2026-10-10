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
      auth:
        process.env.SMTP_USER
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
}
