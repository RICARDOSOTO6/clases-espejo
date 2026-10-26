import { certificadoModoDemo } from './modo-demo';

describe('modo DEMO de los certificados', () => {
  const original = process.env.CERTIFICADO_MODO_DEMO;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CERTIFICADO_MODO_DEMO;
    } else {
      process.env.CERTIFICADO_MODO_DEMO = original;
    }
  });

  it('queda activo por defecto', () => {
    delete process.env.CERTIFICADO_MODO_DEMO;
    expect(certificadoModoDemo()).toBe(true);
  });

  it('se apaga con false, 0, no u off', () => {
    for (const valor of ['false', '0', 'no', 'off']) {
      process.env.CERTIFICADO_MODO_DEMO = valor;
      expect(certificadoModoDemo()).toBe(false);
    }
  });

  it('sigue activo con cualquier otro valor', () => {
    process.env.CERTIFICADO_MODO_DEMO = 'true';
    expect(certificadoModoDemo()).toBe(true);
  });
});
