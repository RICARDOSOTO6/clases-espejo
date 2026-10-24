import {
  corteCaducidad,
  diasAntelacionRevision,
  diasMinimosPropuesta,
  fechaLimiteRevision,
  fechaMinimaPropuesta,
} from './plazos';

describe('plazos configurables', () => {
  it('usa 8 días para proponer y 7 para revisar por defecto', () => {
    expect(diasMinimosPropuesta()).toBe(8);
    expect(diasAntelacionRevision()).toBe(7);
  });

  it('permite pasar los días configurados por la CACE', () => {
    const hoy = new Date(2026, 9, 24, 12);
    expect(fechaMinimaPropuesta(hoy, 10).toISOString()).toBe(
      '2026-11-03T00:00:00.000Z',
    );
    expect(
      fechaLimiteRevision(new Date(Date.UTC(2026, 10, 10)), 5).toISOString(),
    ).toBe('2026-11-05T00:00:00.000Z');
    expect(corteCaducidad(hoy, 5).toISOString()).toBe(
      '2026-10-29T00:00:00.000Z',
    );
  });

  it('ignora valores inválidos y cae al valor seguro', () => {
    expect(diasMinimosPropuesta(-1)).toBe(8);
    expect(diasAntelacionRevision(Number.NaN)).toBe(7);
  });
});
