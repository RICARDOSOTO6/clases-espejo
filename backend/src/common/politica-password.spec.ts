import { PASSWORD_MINIMO, problemaDePassword } from './politica-password';
import { esPasswordComun } from './passwords-comunes';

describe('Política de contraseñas', () => {
  const correo = 'persona@prueba.mx';

  it('acepta una contraseña de 12 caracteres que no sea el correo ni común', () => {
    expect(PASSWORD_MINIMO).toBe(12);
    expect(problemaDePassword('ClaveSegura1', correo)).toBeNull();
  });

  it('rechaza una contraseña más corta que el mínimo', () => {
    const problema = problemaDePassword('ClaveSegura', correo);
    expect(problema).toContain(String(PASSWORD_MINIMO));
  });

  it('rechaza la contraseña igual al correo (sin distinguir mayúsculas)', () => {
    expect(problemaDePassword('Persona@No.es', 'otra@no.es')).toBeNull();
    expect(problemaDePassword('PERSONA@NO.ES', 'persona@no.es')).toBe(
      'La contraseña no puede ser igual a tu correo.',
    );
  });

  it('rechaza contraseñas comunes o con prefijos obvios', () => {
    expect(problemaDePassword('Password1234', correo)).toContain('común');
    expect(problemaDePassword('clasesconjuntas', correo)).toContain('común');
    expect(esPasswordComun('ClaveSegura1')).toBe(false);
  });

  it('no aplica la política a una contraseña vacía con mensaje de longitud', () => {
    expect(problemaDePassword('', correo)).toContain(String(PASSWORD_MINIMO));
  });
});
