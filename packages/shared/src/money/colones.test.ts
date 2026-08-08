import { describe, expect, it } from 'vitest';
import { ErrorDeDinero, esColonesValido, exigirColones, exigirEnteroPositivo, formatearColones } from './colones';

describe('esColonesValido', () => {
  it('acepta enteros >= 0', () => {
    expect(esColonesValido(0)).toBe(true);
    expect(esColonesValido(4500)).toBe(true);
  });

  it('rechaza decimales, negativos y no-números', () => {
    expect(esColonesValido(4500.5)).toBe(false);
    expect(esColonesValido(-1)).toBe(false);
    expect(esColonesValido('4500')).toBe(false);
    expect(esColonesValido(null)).toBe(false);
    expect(esColonesValido(NaN)).toBe(false);
    expect(esColonesValido(Infinity)).toBe(false);
  });
});

describe('exigirColones', () => {
  it('deja pasar un entero válido', () => {
    expect(() => exigirColones(4500)).not.toThrow();
  });

  it('explica por qué falla', () => {
    expect(() => exigirColones(4500.5, 'precio')).toThrow(/precio debe ser un entero de colones/);
    expect(() => exigirColones(-1, 'total')).toThrow(/total no puede ser negativo/);
    expect(() => exigirColones('x', 'monto')).toThrow(/monto debe ser un número/);
    expect(() => exigirColones(Number.MAX_SAFE_INTEGER + 2, 'monto')).toThrow(ErrorDeDinero);
  });
});

describe('exigirEnteroPositivo', () => {
  it('respeta el mínimo indicado', () => {
    expect(() => exigirEnteroPositivo(1, 'cantidad', 1)).not.toThrow();
    expect(() => exigirEnteroPositivo(0, 'cantidad', 1)).toThrow(ErrorDeDinero);
    expect(() => exigirEnteroPositivo(0, 'partes', 0)).not.toThrow();
  });
});

describe('formatearColones', () => {
  it('usa punto como separador de miles, sin decimales', () => {
    expect(formatearColones(8334)).toBe('₡8.334');
    expect(formatearColones(1_234_567)).toBe('₡1.234.567');
  });

  it('no agrega separador bajo mil', () => {
    expect(formatearColones(200)).toBe('₡200');
    expect(formatearColones(0)).toBe('₡0');
  });

  it('puede omitir el símbolo', () => {
    expect(formatearColones(25_000, false)).toBe('25.000');
  });

  it('muestra el signo de los saldos negativos', () => {
    expect(formatearColones(-500)).toBe('-₡500');
  });
});
