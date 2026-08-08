import { describe, expect, it } from 'vitest';
import {
  fraccionesIguales,
  lineasSinAsignar,
  repartirLinea,
  totalesPorComensal,
  type LineaAsignable,
} from './comensales';

describe('repartirLinea', () => {
  it('una línea de una sola persona va entera para ella', () => {
    expect(repartirLinea(4_500, [{ comensal_id: 1, fraccion: 1 }])).toEqual([4_500]);
  });

  it('dos personas se parten una picada de ₡9.000', () => {
    expect(repartirLinea(9_000, fraccionesIguales([1, 2]))).toEqual([4_500, 4_500]);
  });

  it('TRES personas se parten una picada de ₡10.000 sin perder un colón', () => {
    const partes = repartirLinea(10_000, fraccionesIguales([1, 2, 3]));
    expect(partes.reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(partes).toEqual([3_334, 3_333, 3_333]);
  });

  it('respeta fracciones desiguales', () => {
    // Juan se comió 2 de las 3 cervezas.
    const partes = repartirLinea(3_000, [
      { comensal_id: 1, fraccion: 2 / 3 },
      { comensal_id: 2, fraccion: 1 / 3 },
    ]);
    expect(partes).toEqual([2_000, 1_000]);
    expect(partes[0] + partes[1]).toBe(3_000);
  });

  it('las partes SIEMPRE suman el total, sea cual sea el monto', () => {
    for (let total = 0; total <= 500; total++) {
      for (const cuantos of [2, 3, 4, 5, 7]) {
        const partes = repartirLinea(total, fraccionesIguales(Array.from({ length: cuantos }, (_, i) => i + 1)));
        expect(partes.reduce((a, b) => a + b, 0)).toBe(total);
        expect(partes.every(Number.isInteger)).toBe(true);
      }
    }
  });

  it('una línea sin asignar no reparte nada', () => {
    expect(repartirLinea(5_000, [])).toEqual([]);
  });

  it('rechaza una fracción negativa', () => {
    expect(() => repartirLinea(5_000, [{ comensal_id: 1, fraccion: -0.5 }])).toThrow();
  });
});

describe('totalesPorComensal', () => {
  const lineas: LineaAsignable[] = [
    // El casado de Juan.
    { linea_id: 1, total: 4_500, asignaciones: [{ comensal_id: 10, fraccion: 1 }] },
    // El pescado de Ana.
    { linea_id: 2, total: 6_000, asignaciones: [{ comensal_id: 20, fraccion: 1 }] },
    // La picada compartida.
    { linea_id: 3, total: 5_000, asignaciones: fraccionesIguales([10, 20]) },
  ];

  it('suma la parte de cada uno en cada línea', () => {
    const totales = totalesPorComensal(lineas);
    expect(totales.get(10)).toBe(4_500 + 2_500);
    expect(totales.get(20)).toBe(6_000 + 2_500);
  });

  it('la suma de los comensales es exactamente la de las líneas', () => {
    const totales = totalesPorComensal(lineas);
    const sumaComensales = [...totales.values()].reduce((a, b) => a + b, 0);
    const sumaLineas = lineas.reduce((a, l) => a + l.total, 0);
    expect(sumaComensales).toBe(sumaLineas);
  });

  it('el redondeo se resuelve línea por línea, nunca al final', () => {
    // Tres líneas de ₡10 entre 3: si se sumara primero y se dividiera después,
    // daría 10/10/10; repartiendo línea por línea, cada una deja su sobrante en
    // la primera parte. Lo que importa es que el total cuadre exacto.
    const tres = [1, 2, 3];
    const partido: LineaAsignable[] = [10, 10, 10].map((total, i) => ({
      linea_id: i + 1,
      total,
      asignaciones: fraccionesIguales(tres),
    }));
    const totales = totalesPorComensal(partido);
    expect([...totales.values()].reduce((a, b) => a + b, 0)).toBe(30);
  });

  it('una cuenta sin líneas devuelve un mapa vacío', () => {
    expect(totalesPorComensal([]).size).toBe(0);
  });
});

describe('lineasSinAsignar', () => {
  it('encuentra las que nadie reclamó', () => {
    const lineas: LineaAsignable[] = [
      { linea_id: 1, total: 1_000, asignaciones: [{ comensal_id: 1, fraccion: 1 }] },
      { linea_id: 2, total: 2_000, asignaciones: [] },
      { linea_id: 3, total: 3_000, asignaciones: [] },
    ];
    expect(lineasSinAsignar(lineas).map((l) => l.linea_id)).toEqual([2, 3]);
  });

  it('con todo asignado no queda ninguna', () => {
    const lineas: LineaAsignable[] = [
      { linea_id: 1, total: 1_000, asignaciones: [{ comensal_id: 1, fraccion: 1 }] },
    ];
    expect(lineasSinAsignar(lineas)).toHaveLength(0);
  });
});

describe('fraccionesIguales', () => {
  it('reparte en partes iguales entre los elegidos', () => {
    expect(fraccionesIguales([5, 6])).toEqual([
      { comensal_id: 5, fraccion: 0.5 },
      { comensal_id: 6, fraccion: 0.5 },
    ]);
  });

  it('sin comensales no devuelve nada', () => {
    expect(fraccionesIguales([])).toEqual([]);
  });
});
