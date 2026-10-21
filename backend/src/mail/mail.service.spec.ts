import { MailService } from './mail.service';

/** Doble mínimo del transporte SMTP: guarda lo que se le pasa a `sendMail`. */
function servicioConCaptura(): {
  servicio: MailService;
  enviados: Record<string, unknown>[];
} {
  const servicio = new MailService();
  const enviados: Record<string, unknown>[] = [];
  const doble = servicio as unknown as {
    transporter: {
      sendMail: (correo: Record<string, unknown>) => Promise<unknown>;
    };
  };
  doble.transporter = {
    sendMail: (correo) => {
      enviados.push(correo);
      return Promise.resolve();
    },
  };
  return { servicio, enviados };
}

const contenido = {
  asunto: 'Prueba',
  texto: 'Hola',
  html: '<p>Hola</p>',
};

describe('MailService: remitente de los correos', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('sin remitente explícito usa MAIL_FROM', async () => {
    process.env.MAIL_FROM = 'general@prueba.mx';
    const { servicio, enviados } = servicioConCaptura();

    await servicio.enviarCorreo('alguien@prueba.mx', contenido);

    expect(enviados[0].from).toBe('general@prueba.mx');
  });

  it('con remitente explícito (certificados) usa ese', async () => {
    process.env.MAIL_FROM = 'general@prueba.mx';
    const { servicio, enviados } = servicioConCaptura();

    await servicio.enviarCorreo(
      'alguien@prueba.mx',
      contenido,
      undefined,
      'certificados@prueba.mx',
    );

    expect(enviados[0].from).toBe('certificados@prueba.mx');
  });
});
