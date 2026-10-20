import { claveAlfabeticaPais, ordenarPaises } from './identidad-cace.service';

/**
 * La lista de países se ordena en el servidor (y la web pública usa el mismo
 * camino), así que esta prueba fija la regla que el panel da por hecha:
 * alfabético por nombre, sin distinguir mayúsculas ni acentos.
 *
 * Sirve sobre todo para los casos que un `ORDER BY nombre` de SQL hace mal:
 * «África» iría detrás de «Zambia» y «perú» detrás de «Uruguay».
 */
describe('Orden alfabético de los países de la comunidad', () => {
  const paises = [
    { nombre: 'Uruguay' },
    { nombre: 'perú' },
    { nombre: 'Argentina' },
    { nombre: 'España' },
    { nombre: 'Brasil' },
    { nombre: 'méxico' },
    { nombre: 'África' },
  ];

  it('ordena sin distinguir mayúsculas ni acentos', () => {
    expect(ordenarPaises(paises).map((p) => p.nombre)).toEqual([
      'África',
      'Argentina',
      'Brasil',
      'España',
      'méxico',
      'perú',
      'Uruguay',
    ]);
  });

  it('no modifica la lista original', () => {
    const copia = [...paises];
    ordenarPaises(paises);
    expect(paises).toEqual(copia);
  });

  it('normaliza igual un nombre con acentos y sin ellos («peru» → «Perú»)', () => {
    expect(claveAlfabeticaPais('Perú')).toBe('peru');
    expect(claveAlfabeticaPais('PERU')).toBe('peru');
    expect(claveAlfabeticaPais('ÁFRICA')).toBe('africa');
    // Lo que usa el buscador del panel: comparar la clave del país con el texto.
    expect(
      claveAlfabeticaPais('Perú').includes(claveAlfabeticaPais('peru')),
    ).toBe(true);
  });
});
