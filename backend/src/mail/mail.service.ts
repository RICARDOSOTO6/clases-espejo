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
}
