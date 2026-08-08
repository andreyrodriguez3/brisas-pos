import { describe, expect, it } from 'vitest';
import { ErrorDeDinero } from './colones';
import { repartirPartesIguales, repartirPorAtribucion, repartirPorHoras } from './reparto';

const sumaMontos = (partes: { monto: number }[]) => partes.reduce((a, p) => a + p.monto, 0);
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('repartirPorAtribucion — regla A (por defecto)', () => {
  it('cada mesera se lleva exactamente lo de sus propias cuentas', () => {
    expect(
      repartirPorAtribucion([
        { usuario_id: 1, ventas: 87_500 },
        { usuario_id: 2, ventas: 42_300 },
      ]),
    ).toEqual([
      { usuario_id: 1, monto: 87_500 },
      { usuario_id: 2, monto: 42_300 },
    ]);
  });

  it('EL CASO DE LA DUEÑA: una sola mesera se lleva todo', () => {
    // "una mesera va un día de 11 a 5 y todo va a ser para ella"
    const partes = repartirPorAtribucion([{ usuario_id: 7, ventas: 235_000 }]);
    expect(partes).toEqual([{ usuario_id: 7, monto: 235_000 }]);
    expect(sumaMontos(partes)).toBe(235_000);
  });

  it('una mesera que no abrió ninguna cuenta se lleva 0', () => {
    const partes = repartirPorAtribucion([
      { usuario_id: 1, ventas: 50_000 },
      { usuario_id: 2, ventas: 0 },
    ]);
    expect(partes[1].monto).toBe(0);
  });

  it('sin meseras devuelve lista vacía', () => {
    expect(repartirPorAtribucion([])).toEqual([]);
  });

  it('rechaza ventas con decimales o negativas', () => {
    expect(() => repartirPorAtribucion([{ usuario_id: 1, ventas: 100.5 }])).toThrow(ErrorDeDinero);
    expect(() => repartirPorAtribucion([{ usuario_id: 1, ventas: -100 }])).toThrow(ErrorDeDinero);
  });
});

describe('repartirPorHoras — regla B', () => {
  it('reparte proporcional a las horas', () => {
    // 6 h y 2 h sobre ₡80.000 → 3:1
    const partes = repartirPorHoras(80_000, [
      { usuario_id: 1, horas: 6 },
      { usuario_id: 2, horas: 2 },
    ]);
    expect(partes).toEqual([
      { usuario_id: 1, monto: 60_000 },
      { usuario_id: 2, monto: 20_000 },
    ]);
  });

  it('dos meseras con horas desiguales y total no divisible: suma exacta', () => {
    // 5,5 h y 3,25 h sobre ₡100.001
    const total = 100_001;
    const partes = repartirPorHoras(total, [
      { usuario_id: 1, horas: 5.5 },
      { usuario_id: 2, horas: 3.25 },
    ]);
    expect(sumaMontos(partes)).toBe(total);
    expect(partes[0].monto).toBeGreaterThan(partes[1].monto);
  });

  it('una sola mesera se lleva todo el turno', () => {
    const partes = repartirPorHoras(235_000, [{ usuario_id: 7, horas: 6 }]);
    expect(partes).toEqual([{ usuario_id: 7, monto: 235_000 }]);
  });

  it('una mesera con 0 horas no recibe nada si otra sí trabajó', () => {
    const partes = repartirPorHoras(50_000, [
      { usuario_id: 1, horas: 0 },
      { usuario_id: 2, horas: 8 },
    ]);
    expect(partes).toEqual([
      { usuario_id: 1, monto: 0 },
      { usuario_id: 2, monto: 50_000 },
    ]);
  });

  it('si nadie registró horas reparte en partes iguales', () => {
    const partes = repartirPorHoras(1000, [
      { usuario_id: 1, horas: 0 },
      { usuario_id: 2, horas: 0 },
      { usuario_id: 3, horas: 0 },
    ]);
    expect(partes.map((p) => p.monto)).toEqual([334, 333, 333]);
    expect(sumaMontos(partes)).toBe(1000);
  });

  it('con total 0 todas se llevan 0', () => {
    const partes = repartirPorHoras(0, [
      { usuario_id: 1, horas: 6 },
      { usuario_id: 2, horas: 2 },
    ]);
    expect(sumaMontos(partes)).toBe(0);
  });

  it('sin meseras devuelve lista vacía', () => {
    expect(repartirPorHoras(50_000, [])).toEqual([]);
  });

  it('maneja montos grandes sin perder un colón', () => {
    const total = 12_345_678;
    const partes = repartirPorHoras(total, [
      { usuario_id: 1, horas: 7.75 },
      { usuario_id: 2, horas: 4.5 },
      { usuario_id: 3, horas: 1.25 },
    ]);
    expect(sumaMontos(partes)).toBe(total);
  });

  it('la suma es exacta en un barrido amplio de totales y horas', () => {
    const juegos = [
      [6, 2],
      [5.5, 3.25, 1],
      [8, 8, 8, 8],
      [11.5, 0.5],
      [1, 2, 3, 4, 5, 6],
    ];
    for (const horas of juegos) {
      const meseras = horas.map((h, i) => ({ usuario_id: i + 1, horas: h }));
      for (let total = 0; total <= 5000; total += 137) {
        expect(sumaMontos(repartirPorHoras(total, meseras))).toBe(total);
      }
    }
  });

  it('rechaza horas negativas', () => {
    expect(() => repartirPorHoras(1000, [{ usuario_id: 1, horas: -1 }])).toThrow();
  });

  it('rechaza totales con decimales', () => {
    expect(() => repartirPorHoras(1000.5, [{ usuario_id: 1, horas: 4 }])).toThrow(ErrorDeDinero);
  });
});

describe('repartirPartesIguales — regla C', () => {
  it('divide en partes iguales y carga el sobrante a la primera', () => {
    expect(repartirPartesIguales(25_000, 3)).toEqual([8334, 8333, 8333]);
  });

  it('con una sola mesera se lleva todo', () => {
    expect(repartirPartesIguales(235_000, 1)).toEqual([235_000]);
  });

  it('con total 0 devuelve ceros', () => {
    expect(repartirPartesIguales(0, 3)).toEqual([0, 0, 0]);
  });

  it('maneja montos grandes sin perder un colón', () => {
    const total = 999_999_999;
    expect(suma(repartirPartesIguales(total, 6))).toBe(total);
  });

  it('rechaza 0 meseras', () => {
    expect(() => repartirPartesIguales(1000, 0)).toThrow(ErrorDeDinero);
  });
});

describe('las tres reglas sobre el mismo turno', () => {
  it('reparten el mismo dinero de tres maneras, y cada una suma exacto', () => {
    // Turno real: María abrió ₡120.000 en 6 h, Ana ₡35.001 en 3 h.
    const ventas = [
      { usuario_id: 1, ventas: 120_000 },
      { usuario_id: 2, ventas: 35_001 },
    ];
    const horas = [
      { usuario_id: 1, horas: 6 },
      { usuario_id: 2, horas: 3 },
    ];
    const totalTurno = 155_001;

    const a = repartirPorAtribucion(ventas);
    const b = repartirPorHoras(totalTurno, horas);
    const c = repartirPartesIguales(totalTurno, 2);

    expect(sumaMontos(a)).toBe(totalTurno);
    expect(sumaMontos(b)).toBe(totalTurno);
    expect(suma(c)).toBe(totalTurno);

    // Y dan números distintos — por eso el cierre muestra las tres.
    expect(a[0].monto).not.toBe(b[0].monto);
    expect(b[0].monto).not.toBe(c[0]);
  });
});
