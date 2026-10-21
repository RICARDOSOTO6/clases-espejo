import { TOPE_EMISION_POR_CLASE, mensajeTopeEmision } from './limites';

describe('Tope de emisión por clase', () => {
  it('el tope es 500 certificados', () => {
    expect(TOPE_EMISION_POR_CLASE).toBe(500);
  });

  it('el aviso dice cuántos hay y cuál es el máximo', () => {
    const mensaje = mensajeTopeEmision(640);
    expect(mensaje).toContain('640');
    expect(mensaje).toContain(String(TOPE_EMISION_POR_CLASE));
    expect(mensaje).toContain('no puede emitir');
  });
});
