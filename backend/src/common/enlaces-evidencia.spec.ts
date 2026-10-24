import {
  dominioDeEnlacePermitido,
  validarEnlaceEvidencia,
} from './enlaces-evidencia';

describe('enlaces de evidencia', () => {
  it('acepta los proveedores de la lista blanca', () => {
    const enlaces = [
      'https://youtu.be/abc123',
      'https://www.youtube.com/watch?v=abc123',
      'https://vimeo.com/123456',
      'https://drive.google.com/file/d/abc/view',
      'https://1drv.ms/u/s!abc',
      'https://onedrive.live.com/view.aspx?id=abc',
    ];

    for (const enlace of enlaces) {
      expect(validarEnlaceEvidencia(enlace)).toBe(enlace);
    }
  });

  it('rechaza http, dominios ajenos y credenciales', () => {
    expect(() => validarEnlaceEvidencia('http://youtu.be/abc')).toThrow(
      'https',
    );
    expect(() =>
      validarEnlaceEvidencia('https://youtube.com.evil.example/video'),
    ).toThrow('dominio');
    expect(() =>
      validarEnlaceEvidencia('https://usuario:clave@youtu.be/abc'),
    ).toThrow('usuario');
    expect(() => validarEnlaceEvidencia('https://example.com/video')).toThrow(
      'dominio',
    );
  });

  it('compara el dominio sin distinguir mayúsculas', () => {
    expect(dominioDeEnlacePermitido('YouTube.com')).toBe(true);
    expect(dominioDeEnlacePermitido('youtube.com.evil.example')).toBe(false);
  });
});
