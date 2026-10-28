import { validarSecretoJwt } from './jwt-secret';

describe('validarSecretoJwt', () => {
  it('acepta un secreto de 32 bytes o más', () => {
    const secreto = '0123456789abcdef0123456789abcdef';
    expect(validarSecretoJwt(secreto)).toBe(secreto);
  });

  it('rechaza un secreto corto o vacío', () => {
    expect(() => validarSecretoJwt('corto')).toThrow(/32 bytes/);
    expect(() => validarSecretoJwt(undefined)).toThrow(/32 bytes/);
  });
});
