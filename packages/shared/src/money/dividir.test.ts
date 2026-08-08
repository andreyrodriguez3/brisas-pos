import { describe, expect, it } from 'vitest';
import { ErrorDeDinero } from './colones';
import { dividirEnPartes, repartirPorPesos } from './dividir';

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('dividirEnPartes', () => {
  it('reparte exacto cuando el total es divisible', () => {
    expect(dividirEnPartes(9000, 3)).toEqual([3000, 3000, 3000]);
  });

  it('carga el sobrante a la primera parte (caso del plan de trabajo)', () => {
    expect(dividirEnPartes(25000, 3)).toEqual([8334, 8333, 8333]);
  });

  it('carga los dos colones sobrantes a la primera parte', () => {
    // 25001 / 3 = 8333,67 → sobran 2
    expect(dividirEnPartes(25001, 3)).toEqual([8335, 8333, 8333]);
  });

  it('con n = 1 devuelve el total completo', () => {
    expect(dividirEnPartes(17450, 1)).toEqual([17450]);
  });

  it('con total 0 devuelve puros ceros', () => {
    expect(dividirEnPartes(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('con total 0 y n = 1 devuelve [0]', () => {
    expect(dividirEnPartes(0, 1)).toEqual([0]);
  });

  it('reparte bien cuando el total es menor que la cantidad de partes', () => {
    const partes = dividirEnPartes(2, 5);
    expect(partes).toEqual([2, 0, 0, 0, 0]);
    expect(suma(partes)).toBe(2);
  });

  it('maneja montos grandes sin perder un colón', () => {
    const total = 987_654_321;
    const partes = dividirEnPartes(total, 7);
    expect(suma(partes)).toBe(total);
  });

  it('la suma de las partes es SIEMPRE exactamente el total', () => {
    for (let total = 0; total <= 400; total++) {
      for (let n = 1; n <= 13; n++) {
        const partes = dividirEnPartes(total, n);
        expect(partes).toHaveLength(n);
        expect(suma(partes)).toBe(total);
        // Toda la diferencia entre partes es el sobrante, y vive en la primera.
        expect(Math.max(...partes) - Math.min(...partes)).toBe(total % n);
        expect(partes[0]).toBe(Math.floor(total / n) + (total % n));
      }
    }
  });

  it('rechaza totales con decimales — el dinero es entero', () => {
    expect(() => dividirEnPartes(100.5, 2)).toThrow(ErrorDeDinero);
  });

  it('rechaza totales negativos', () => {
    expect(() => dividirEnPartes(-100, 2)).toThrow(ErrorDeDinero);
  });

  it('rechaza n = 0 y n negativo', () => {
    expect(() => dividirEnPartes(1000, 0)).toThrow(ErrorDeDinero);
    expect(() => dividirEnPartes(1000, -3)).toThrow(ErrorDeDinero);
  });

  it('rechaza n con decimales', () => {
    expect(() => dividirEnPartes(1000, 2.5)).toThrow(ErrorDeDinero);
  });
});

describe('repartirPorPesos', () => {
  it('reparte proporcionalmente y suma exacto', () => {
    // Pesos 1:3 sobre 1000 → 250 / 750
    expect(repartirPorPesos(1000, [1, 3])).toEqual([250, 750]);
  });

  it('usa el resto mayor cuando la proporción no es exacta', () => {
    // 100 en pesos 1:1:1 → 33,33 cada uno. Sobra 1, va al primer resto mayor.
    const partes = repartirPorPesos(100, [1, 1, 1]);
    expect(suma(partes)).toBe(100);
    expect(partes).toEqual([34, 33, 33]);
  });

  it('un peso en 0 no recibe nada mientras haya otros pesos', () => {
    expect(repartirPorPesos(1000, [0, 5])).toEqual([0, 1000]);
  });

  it('si todos los pesos son 0 cae en partes iguales', () => {
    expect(repartirPorPesos(1000, [0, 0, 0])).toEqual([334, 333, 333]);
  });

  it('con lista vacía devuelve lista vacía', () => {
    expect(repartirPorPesos(1000, [])).toEqual([]);
  });

  it('la suma es exacta para muchas combinaciones', () => {
    const juegosDePesos = [
      [1, 2],
      [7, 11, 13],
      [1, 1, 1, 1, 1, 1, 1],
      [360, 120, 45],
      [1, 999],
    ];
    for (const pesos of juegosDePesos) {
      for (let total = 0; total <= 300; total += 7) {
        expect(suma(repartirPorPesos(total, pesos))).toBe(total);
      }
    }
  });

  it('rechaza pesos negativos o con decimales', () => {
    expect(() => repartirPorPesos(1000, [1, -1])).toThrow();
    expect(() => repartirPorPesos(1000, [1.5, 2])).toThrow();
  });
});
