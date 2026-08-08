import { describe, expect, it } from 'vitest';
import { aplicarDescuentos, calcularDescuento } from './descuentos';

describe('calcularDescuento — MONTO', () => {
  it('descuenta los colones indicados', () => {
    expect(calcularDescuento(10_000, { tipo: 'MONTO', valor: 2_000 })).toBe(2_000);
  });

  it('NUNCA descuenta más que la base: la cuenta no puede quedar en negativo', () => {
    expect(calcularDescuento(8_000, { tipo: 'MONTO', valor: 50_000 })).toBe(8_000);
  });

  it('rechaza un monto con decimales', () => {
    expect(() => calcularDescuento(10_000, { tipo: 'MONTO', valor: 1_500.5 })).toThrow();
  });

  it('rechaza un monto negativo', () => {
    expect(() => calcularDescuento(10_000, { tipo: 'MONTO', valor: -500 })).toThrow();
  });
});

describe('calcularDescuento — PORCENTAJE', () => {
  it('el 10 % de ₡20.000 son ₡2.000', () => {
    expect(calcularDescuento(20_000, { tipo: 'PORCENTAJE', valor: 10 })).toBe(2_000);
  });

  it('redondea al colón más cercano, como se hace a mano', () => {
    // 10 % de 8.335 = 833,5 → ₡834
    expect(calcularDescuento(8_335, { tipo: 'PORCENTAJE', valor: 10 })).toBe(834);
  });

  it('el 100 % descuenta todo', () => {
    expect(calcularDescuento(12_345, { tipo: 'PORCENTAJE', valor: 100 })).toBe(12_345);
  });

  it('el 0 % no descuenta nada', () => {
    expect(calcularDescuento(12_345, { tipo: 'PORCENTAJE', valor: 0 })).toBe(0);
  });

  it('rechaza un porcentaje mayor a 100', () => {
    expect(() => calcularDescuento(10_000, { tipo: 'PORCENTAJE', valor: 120 })).toThrow(/entre 0 y 100/);
  });

  it('rechaza un porcentaje negativo', () => {
    expect(() => calcularDescuento(10_000, { tipo: 'PORCENTAJE', valor: -5 })).toThrow();
  });

  it('el resultado siempre es un entero de colones', () => {
    for (let total = 1; total <= 300; total++) {
      for (const porcentaje of [7, 13, 33, 50, 99]) {
        const monto = calcularDescuento(total, { tipo: 'PORCENTAJE', valor: porcentaje });
        expect(Number.isInteger(monto)).toBe(true);
      }
    }
  });
});

describe('calcularDescuento — CORTESÍA', () => {
  it('la casa invita: se va todo', () => {
    expect(calcularDescuento(15_400, { tipo: 'CORTESIA', valor: 0 })).toBe(15_400);
  });

  it('sobre una cuenta en cero no rompe nada', () => {
    expect(calcularDescuento(0, { tipo: 'CORTESIA', valor: 0 })).toBe(0);
  });
});

describe('aplicarDescuentos — varios seguidos', () => {
  it('sin descuentos el neto es el total', () => {
    const r = aplicarDescuentos(10_000, []);
    expect(r).toEqual({ descuento: 0, neto: 10_000, detalle: [] });
  });

  it('cada uno se calcula sobre lo que quedaba, no sobre el original', () => {
    // 10 % de 10.000 = 1.000 → quedan 9.000. 10 % de 9.000 = 900.
    const r = aplicarDescuentos(10_000, [
      { tipo: 'PORCENTAJE', valor: 10 },
      { tipo: 'PORCENTAJE', valor: 10 },
    ]);
    expect(r.detalle).toEqual([1_000, 900]);
    expect(r.descuento).toBe(1_900);
    expect(r.neto).toBe(8_100);
  });

  it('dos descuentos grandes NO dejan la cuenta en negativo', () => {
    // Sobre el original serían 120 %. Encadenados, nunca pasan del total.
    const r = aplicarDescuentos(10_000, [
      { tipo: 'PORCENTAJE', valor: 60 },
      { tipo: 'PORCENTAJE', valor: 60 },
    ]);
    expect(r.neto).toBeGreaterThanOrEqual(0);
    expect(r.descuento + r.neto).toBe(10_000);
  });

  it('una cortesía después de un descuento se lleva lo que quedaba', () => {
    const r = aplicarDescuentos(10_000, [
      { tipo: 'MONTO', valor: 2_000 },
      { tipo: 'CORTESIA', valor: 0 },
    ]);
    expect(r.detalle).toEqual([2_000, 8_000]);
    expect(r.neto).toBe(0);
  });

  it('descuento + neto siempre es exactamente el total', () => {
    const casos = [
      [7_777, [{ tipo: 'PORCENTAJE' as const, valor: 33 }]],
      [12_345, [{ tipo: 'MONTO' as const, valor: 999 }, { tipo: 'PORCENTAJE' as const, valor: 7 }]],
      [1, [{ tipo: 'PORCENTAJE' as const, valor: 50 }]],
    ] as const;

    for (const [total, descuentos] of casos) {
      const r = aplicarDescuentos(total, descuentos);
      expect(r.descuento + r.neto).toBe(total);
    }
  });
});
