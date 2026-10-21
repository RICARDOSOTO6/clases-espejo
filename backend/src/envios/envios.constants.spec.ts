import {
  ESPERAS_REINTENTO_MINUTOS,
  MAX_INTENTOS_ENVIO,
  esperaReintentoMinutos,
} from './envios.constants';

describe('Cola de correo: espera entre reintentos', () => {
  it('espera 1, 5, 15 y 60 minutos después de cada fallo', () => {
    expect(esperaReintentoMinutos(1)).toBe(1);
    expect(esperaReintentoMinutos(2)).toBe(5);
    expect(esperaReintentoMinutos(3)).toBe(15);
    expect(esperaReintentoMinutos(4)).toBe(60);
  });

  it('no se sale de la tabla aunque lleguen números raros', () => {
    expect(esperaReintentoMinutos(0)).toBe(1);
    expect(esperaReintentoMinutos(99)).toBe(60);
  });

  it('hay más de un intento y la tabla tiene una espera por reintento', () => {
    expect(MAX_INTENTOS_ENVIO).toBeGreaterThan(1);
    expect(ESPERAS_REINTENTO_MINUTOS.length).toBe(MAX_INTENTOS_ENVIO - 1);
  });
});
