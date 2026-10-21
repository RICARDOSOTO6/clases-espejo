import { PASSWORD_MINIMO, problemaDePassword } from './politica-password';

describe('Política de contraseñas', () => {
  const correo = 'persona@prueba.mx';

  it('acepta una contraseña de 10 caracteres que no sea el correo', () => {
    expect(problemaDePassword('ClaveSegura1', correo)).toBeNull();
  });

  it('rechaza una contraseña más corta que el mínimo', () => {
    const problema = problemaDePassword('Corta1', correo);
    expect(problema).toContain(String(PASSWORD_MINIMO));
  });

  it('rechaza la contraseña igual al correo (sin distinguir mayúsculas)', () => {
    expect(problemaDePassword('Persona@No.es', 'otra@no.es')).toBeNull();
    expect(problemaDePassword('PERSONA@NO.ES', 'persona@no.es')).toBe(
      'La contraseña no puede ser igual a tu correo.',
    );
  });

  it('rechaza un único carácter repetido', () => {
    expect(problemaDePassword('aaaaaaaaaaaa', correo)).toContain('repetido');
  });

  it('no aplica la política a una contraseña vacía con mensaje de longitud', () => {
    expect(problemaDePassword('', correo)).toContain(String(PASSWORD_MINIMO));
  });
});
