import { PAISES_ISO, paisPorCodigo, resolverPaisIso } from './paises-iso';

describe('Catálogo de países (nombre o código ISO)', () => {
  it('resuelve el código ISO en mayúsculas o minúsculas', () => {
    expect(resolverPaisIso('MX')?.nombre).toBe('México');
    expect(resolverPaisIso('mx')?.codigo).toBe('MX');
    expect(resolverPaisIso(' ar ')?.codigo).toBe('AR');
  });

  it('resuelve el nombre aunque cambien tildes, mayúsculas o espacios', () => {
    expect(resolverPaisIso('México')?.codigo).toBe('MX');
    expect(resolverPaisIso('mexico')?.codigo).toBe('MX');
    expect(resolverPaisIso('  MÉXICO  ')?.codigo).toBe('MX');
    expect(resolverPaisIso('Peru')?.codigo).toBe('PE');
  });

  it('acepta nombres coloquiales habituales', () => {
    expect(resolverPaisIso('EE.UU.')?.codigo).toBe('US');
    expect(resolverPaisIso('USA')?.codigo).toBe('US');
    expect(resolverPaisIso('Holanda')?.codigo).toBe('NL');
    expect(resolverPaisIso('Reino Unido')?.codigo).toBe('GB');
  });

  it('no inventa países: devuelve null si no lo reconoce', () => {
    expect(resolverPaisIso('Narnia')).toBeNull();
    expect(resolverPaisIso('ZZ')).toBeNull();
    expect(resolverPaisIso('   ')).toBeNull();
  });

  it('el catálogo no repite códigos y tiene los 193 del registro', () => {
    expect(PAISES_ISO).toHaveLength(193);
    expect(new Set(PAISES_ISO.map((pais) => pais.codigo)).size).toBe(193);
    expect(paisPorCodigo('ar')?.nombre).toBe('Argentina');
    expect(paisPorCodigo('no-existe')).toBeNull();
  });
});
