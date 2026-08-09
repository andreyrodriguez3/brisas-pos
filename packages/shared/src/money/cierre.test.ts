import { describe, expect, it } from 'vitest';
import {
  calcularReparto,
  montoSegunRegla,
  totalizarCuentas,
  ventasPorMesera,
  type CuentaDeCierre,
} from './cierre';

const platillo = (precio: number, cantidad = 1) => ({
  cantidad,
  precio_unit_snapshot: precio,
  es_envase: false,
});

const envase = (cantidad = 1) => ({
  cantidad,
  precio_unit_snapshot: 200,
  es_envase: true,
});

// ══════════════════════════════════════════════════════════════════════════
//  EL CASO TRAMPA. Es el que más caro sale de todo el dominio.
// ══════════════════════════════════════════════════════════════════════════

describe('⚠️ El caso trampa: salón + «se lo lleva»', () => {
  /**
   * Don Carlos come EN EL SALÓN: un casado de ₡4.500 y un fresco de ₡1.300.
   * Le sobra medio casado y pide llevárselo, así que se le cobra un envase.
   *
   * Toda su comida es venta de SALÓN. Solo los ₡200 del envase van a la bolsa
   * de envases. Ni un colón se movió.
   */
  const donCarlos: CuentaDeCierre = {
    canal: 'SALON',
    mesera_responsable_id: 1,
    lineas: [platillo(4_500), platillo(1_300), envase()],
  };

  it('toda la comida suma a SALÓN y solo ₡200 a ENVASES', () => {
    expect(totalizarCuentas([donCarlos])).toEqual({
      salon: 5_800,
      para_llevar: 0,
      envases: 200,
    });
  });

  it('NO suma ni un colón a para llevar', () => {
    expect(totalizarCuentas([donCarlos]).para_llevar).toBe(0);
  });

  it('la venta se le sigue atribuyendo a su mesera, completa', () => {
    expect(ventasPorMesera([donCarlos], [1])).toEqual([{ usuario_id: 1, ventas: 5_800 }]);
  });

  it('el envase NO se le atribuye a la mesera: es empaque, no venta suya', () => {
    const [maria] = ventasPorMesera([donCarlos], [1]);
    expect(maria.ventas).toBe(5_800);
    expect(maria.ventas).not.toBe(6_000);
  });

  it('dos cuentas con el MISMO consumo van a bolsas distintas solo por su canal', () => {
    const mismasLineas = [platillo(4_500), platillo(1_300), envase()];

    const enSalon: CuentaDeCierre = { canal: 'SALON', mesera_responsable_id: 1, lineas: mismasLineas };
    const paraLlevar: CuentaDeCierre = { canal: 'PARA_LLEVAR', mesera_responsable_id: null, lineas: mismasLineas };

    expect(totalizarCuentas([enSalon])).toEqual({ salon: 5_800, para_llevar: 0, envases: 200 });
    expect(totalizarCuentas([paraLlevar])).toEqual({ salon: 0, para_llevar: 5_800, envases: 200 });
  });
});

describe('totalizarCuentas', () => {
  it('sin cuentas, las tres bolsas en cero', () => {
    expect(totalizarCuentas([])).toEqual({ salon: 0, para_llevar: 0, envases: 0 });
  });

  it('suma varias cuentas de los dos canales', () => {
    const cuentas: CuentaDeCierre[] = [
      { canal: 'SALON', mesera_responsable_id: 1, lineas: [platillo(4_500, 2)] },
      { canal: 'SALON', mesera_responsable_id: 2, lineas: [platillo(3_000)] },
      { canal: 'PARA_LLEVAR', mesera_responsable_id: null, lineas: [platillo(5_000), envase(2)] },
    ];
    expect(totalizarCuentas(cuentas)).toEqual({
      salon: 12_000,
      para_llevar: 5_000,
      envases: 400,
    });
  });

  it('una línea anulada no suma a ninguna bolsa', () => {
    const cuenta: CuentaDeCierre = {
      canal: 'SALON',
      mesera_responsable_id: 1,
      lineas: [platillo(4_500), { ...platillo(9_999), anulada: true }],
    };
    expect(totalizarCuentas([cuenta]).salon).toBe(4_500);
  });

  it('los envases de una cuenta PARA_LLEVAR también van a ENVASES, no a para llevar', () => {
    const cuenta: CuentaDeCierre = {
      canal: 'PARA_LLEVAR',
      mesera_responsable_id: null,
      lineas: [platillo(3_000), envase(3)],
    };
    const t = totalizarCuentas([cuenta]);
    expect(t.para_llevar).toBe(3_000);
    expect(t.envases).toBe(600);
  });

  it('cuenta los extras congelados de las opciones', () => {
    const cuenta: CuentaDeCierre = {
      canal: 'SALON',
      mesera_responsable_id: 1,
      lineas: [
        {
          cantidad: 2,
          precio_unit_snapshot: 4_000,
          opciones: [{ precio_extra_snapshot: 500 }],
          es_envase: false,
        },
      ],
    };
    expect(totalizarCuentas([cuenta]).salon).toBe(9_000);
  });
});

describe('ventasPorMesera', () => {
  const cuentas: CuentaDeCierre[] = [
    { canal: 'SALON', mesera_responsable_id: 1, lineas: [platillo(10_000)] },
    { canal: 'SALON', mesera_responsable_id: 2, lineas: [platillo(6_000), envase()] },
    { canal: 'PARA_LLEVAR', mesera_responsable_id: null, lineas: [platillo(20_000)] },
  ];

  it('cada mesera se queda con lo de sus cuentas', () => {
    expect(ventasPorMesera(cuentas, [1, 2])).toEqual([
      { usuario_id: 1, ventas: 10_000 },
      { usuario_id: 2, ventas: 6_000 },
    ]);
  });

  it('lo de para llevar no es de ninguna mesera', () => {
    const suma = ventasPorMesera(cuentas, [1, 2]).reduce((a, m) => a + m.ventas, 0);
    expect(suma).toBe(16_000);
  });

  it('una mesera sin cuentas aparece en cero, no desaparece', () => {
    expect(ventasPorMesera(cuentas, [1, 2, 9])).toContainEqual({ usuario_id: 9, ventas: 0 });
  });
});

describe('calcularReparto — las tres reglas, siempre', () => {
  const cuentas: CuentaDeCierre[] = [
    { canal: 'SALON', mesera_responsable_id: 1, lineas: [platillo(60_000)] },
    { canal: 'SALON', mesera_responsable_id: 2, lineas: [platillo(40_000)] },
    // No entra al reparto: es la cuenta aparte de la dueña.
    { canal: 'PARA_LLEVAR', mesera_responsable_id: null, lineas: [platillo(30_000), envase(2)] },
  ];

  it('reparte el PORCENTAJE de SALÓN, no el total', () => {
    const r = calcularReparto(cuentas, [{ usuario_id: 1, horas: 6 }, { usuario_id: 2, horas: 6 }], 'ATRIBUCION', 10);
    expect(r.base_reparto).toBe(10_000);
    expect(r.porcentaje_propina).toBe(10);
  });

  it('por atribución cada una se lleva el porcentaje de lo suyo', () => {
    const r = calcularReparto(cuentas, [{ usuario_id: 1, horas: 3 }, { usuario_id: 2, horas: 9 }], 'ATRIBUCION', 10);
    expect(r.meseras.map((m) => m.monto_atribucion)).toEqual([6_000, 4_000]);
  });

  it('por horas reparte en proporción a lo trabajado, sobre la base ya escalada', () => {
    const r = calcularReparto(cuentas, [{ usuario_id: 1, horas: 3 }, { usuario_id: 2, horas: 9 }], 'HORAS', 10);
    expect(r.meseras.map((m) => m.monto_horas)).toEqual([2_500, 7_500]);
  });

  it('en partes iguales el sobrante va a la primera', () => {
    const impar: CuentaDeCierre[] = [{ canal: 'SALON', mesera_responsable_id: 1, lineas: [platillo(25_000)] }];
    const r = calcularReparto(
      impar,
      [{ usuario_id: 1, horas: 6 }, { usuario_id: 2, horas: 6 }, { usuario_id: 3, horas: 6 }],
      'PARTES_IGUALES',
      10,
    );
    // Base: 10% de ₡25.000 = ₡2.500, entre 3 → 834/833/833.
    expect(r.meseras.map((m) => m.monto_partes_iguales)).toEqual([834, 833, 833]);
  });

  it('las tres reglas suman siempre la misma base (el porcentaje del salón)', () => {
    const meseras = [{ usuario_id: 1, horas: 5.5 }, { usuario_id: 2, horas: 3.25 }];
    const r = calcularReparto(cuentas, meseras, 'ATRIBUCION', 10);

    const suma = (f: (m: (typeof r.meseras)[number]) => number) => r.meseras.reduce((a, m) => a + f(m), 0);
    expect(suma((m) => m.monto_horas)).toBe(10_000);
    expect(suma((m) => m.monto_partes_iguales)).toBe(10_000);
    // ATRIBUCION escala cada venta por separado (no reparte un "pool"), así que
    // en general puede diferir del total ya escalado por redondeo independiente.
    // Acá coincide porque ambas ventas son múltiplos exactos del porcentaje.
    expect(suma((m) => m.monto_atribucion)).toBe(10_000);
  });

  it('EL CASO DE ANDREY: ₡1.000.000 de salón, 10% → ₡100.000 a repartir entre las meseras', () => {
    const millon: CuentaDeCierre[] = [{ canal: 'SALON', mesera_responsable_id: 1, lineas: [platillo(1_000_000)] }];
    const r = calcularReparto(
      millon,
      [{ usuario_id: 1, horas: 6 }, { usuario_id: 2, horas: 6 }],
      'PARTES_IGUALES',
      10,
    );
    expect(r.base_reparto).toBe(100_000);
    // "si fueran 2 le toca 50.000 a cada una"
    expect(r.meseras.map((m) => m.monto_partes_iguales)).toEqual([50_000, 50_000]);
  });

  it('EL CASO TRAMPA: ventas_atribuidas queda en el 100% bruto, monto_atribucion en el porcentaje real', () => {
    const r = calcularReparto(cuentas, [{ usuario_id: 1, horas: 6.5 }], 'ATRIBUCION', 10);
    expect(r.meseras[0].horas_trabajadas).toBe(6.5);
    // Vendió ₡60.000 (contexto, informativo)...
    expect(r.meseras[0].ventas_atribuidas).toBe(60_000);
    // ...pero lo que se reparte es el 10% de eso, no los ₡60.000 completos.
    expect(r.meseras[0].monto_atribucion).toBe(6_000);
  });

  it('con una sola mesera, las tres reglas dan lo mismo: el porcentaje de lo que vendió', () => {
    // "Una mesera va un día de 11 a 5 y todo va a ser para ella" — la dueña.
    const sola: CuentaDeCierre[] = [{ canal: 'SALON', mesera_responsable_id: 7, lineas: [platillo(83_000)] }];
    const r = calcularReparto(sola, [{ usuario_id: 7, horas: 6 }], 'ATRIBUCION', 10);
    expect(r.meseras[0]).toMatchObject({
      monto_atribucion: 8_300,
      monto_horas: 8_300,
      monto_partes_iguales: 8_300,
    });
  });

  it('sin meseras en el turno no explota', () => {
    const r = calcularReparto(cuentas, [], 'ATRIBUCION', 10);
    expect(r.meseras).toEqual([]);
    expect(r.base_reparto).toBe(10_000);
  });

  it('con porcentaje distinto de 10, escala igual', () => {
    const r = calcularReparto(cuentas, [{ usuario_id: 1, horas: 6 }], 'ATRIBUCION', 15);
    expect(r.base_reparto).toBe(15_000);
    expect(r.porcentaje_propina).toBe(15);
  });
});

describe('montoSegunRegla', () => {
  const mesera = {
    usuario_id: 1,
    horas_trabajadas: 6,
    ventas_atribuidas: 10_000,
    monto_atribucion: 10_000,
    monto_horas: 8_000,
    monto_partes_iguales: 9_000,
  };

  it('elige el de la regla activa', () => {
    expect(montoSegunRegla(mesera, 'ATRIBUCION')).toBe(10_000);
    expect(montoSegunRegla(mesera, 'HORAS')).toBe(8_000);
    expect(montoSegunRegla(mesera, 'PARTES_IGUALES')).toBe(9_000);
  });
});
