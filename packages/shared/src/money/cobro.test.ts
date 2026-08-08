import { describe, expect, it } from 'vitest';
import { estaSaldada, resumirCobro } from './cobro';

describe('resumirCobro', () => {
  it('sin descuentos ni pagos, el saldo es el total', () => {
    const r = resumirCobro(12_000, [], []);
    expect(r).toMatchObject({ subtotal: 12_000, descuento: 0, total: 12_000, pagado: 0, saldo: 12_000 });
  });

  it('descuenta y deja ver cuánto descontó cada uno', () => {
    const r = resumirCobro(10_000, [{ tipo: 'PORCENTAJE', valor: 10 }], []);
    expect(r.descuento).toBe(1_000);
    expect(r.total).toBe(9_000);
    expect(r.detalleDescuentos).toEqual([1_000]);
  });

  it('un pago parcial deja saldo pendiente', () => {
    const r = resumirCobro(12_000, [], [{ monto: 5_000 }]);
    expect(r.pagado).toBe(5_000);
    expect(r.saldo).toBe(7_000);
    expect(estaSaldada(r)).toBe(false);
  });

  it('varios pagos parciales que completan dejan la cuenta saldada', () => {
    const r = resumirCobro(12_000, [], [{ monto: 5_000 }, { monto: 4_000 }, { monto: 3_000 }]);
    expect(r.saldo).toBe(0);
    expect(estaSaldada(r)).toBe(true);
  });

  it('una cortesía deja la cuenta saldada sin cobrar nada', () => {
    const r = resumirCobro(12_000, [{ tipo: 'CORTESIA', valor: 0 }], []);
    expect(r.total).toBe(0);
    expect(r.saldo).toBe(0);
    expect(estaSaldada(r)).toBe(true);
  });

  it('el saldo nunca es negativo, aunque se registre de más', () => {
    const r = resumirCobro(10_000, [], [{ monto: 15_000 }]);
    expect(r.saldo).toBe(0);
    // La diferencia sigue visible comparando pagado contra total.
    expect(r.pagado - r.total).toBe(5_000);
  });

  it('el descuento se aplica ANTES de comparar con lo pagado', () => {
    // 20.000 con 50 % de descuento = 10.000. Un pago de 10.000 la salda.
    const r = resumirCobro(20_000, [{ tipo: 'PORCENTAJE', valor: 50 }], [{ monto: 10_000 }]);
    expect(r.saldo).toBe(0);
    expect(estaSaldada(r)).toBe(true);
  });

  it('rechaza un subtotal con decimales', () => {
    expect(() => resumirCobro(1_000.5, [], [])).toThrow();
  });

  it('rechaza un pago con decimales', () => {
    expect(() => resumirCobro(1_000, [], [{ monto: 500.5 }])).toThrow();
  });
});
