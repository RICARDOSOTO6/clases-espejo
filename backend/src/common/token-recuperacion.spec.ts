import {
  generarTokenRecuperacion,
  hashTokenRecuperacion,
} from './token-recuperacion';

describe('Token de recuperación', () => {
  it('genera tokens largos, aleatorios y distintos', () => {
    const uno = generarTokenRecuperacion();
    const otro = generarTokenRecuperacion();
    expect(uno.length).toBeGreaterThanOrEqual(40);
    expect(uno).not.toBe(otro);
  });

  it('el hash es estable y no revela el token', () => {
    const token = generarTokenRecuperacion();
    expect(hashTokenRecuperacion(token)).toBe(hashTokenRecuperacion(token));
    expect(hashTokenRecuperacion(token)).not.toContain(token);
    expect(hashTokenRecuperacion(token)).toHaveLength(64);
  });
});
