import { describe, expect, it } from 'vitest';
import { ErrorDeDinero } from './colones';
import { calcularTotalLinea, sumarLineas, totalizadorDeLinea } from './lineas';

describe('calcularTotalLinea', () => {
  it('multiplica precio congelado por cantidad', () => {
    expect(calcularTotalLinea({ cantidad: 2, precio_unit_snapshot: 4500 })).toBe(9000);
  });

  it('suma los extras congelados de las opciones antes de multiplicar', () => {
    const total = calcularTotalLinea({
      cantidad: 3,
      precio_unit_snapshot: 4000,
      opciones: [{ precio_extra_snapshot: 500 }, { precio_extra_snapshot: 250 }],
    });
    expect(total).toBe((4000 + 500 + 250) * 3);
  });

  it('las opciones sin costo extra no mueven el total', () => {
    const total = calcularTotalLinea({
      cantidad: 1,
      precio_unit_snapshot: 5000,
      opciones: [{ precio_extra_snapshot: 0 }],
    });
    expect(total).toBe(5000);
  });

  it('una línea anulada vale 0', () => {
    expect(
      calcularTotalLinea({ cantidad: 4, precio_unit_snapshot: 9999, anulada: true }),
    ).toBe(0);
  });

  it('no aplica IVA ni servicio: el total es la multiplicación pelada', () => {
    // Los precios del menú YA incluyen IVA 13% y servicio 10%.
    const precio = 6500;
    expect(calcularTotalLinea({ cantidad: 1, precio_unit_snapshot: precio })).toBe(precio);
  });

  it('un producto sin precio cargado no se puede cobrar', () => {
    expect(() =>
      calcularTotalLinea({
        cantidad: 1,
        precio_unit_snapshot: null as unknown as number,
      }),
    ).toThrow(ErrorDeDinero);
  });

  it('rechaza cantidad 0 y cantidad con decimales', () => {
    expect(() => calcularTotalLinea({ cantidad: 0, precio_unit_snapshot: 100 })).toThrow(ErrorDeDinero);
    expect(() => calcularTotalLinea({ cantidad: 1.5, precio_unit_snapshot: 100 })).toThrow(ErrorDeDinero);
  });

  it('rechaza precios con decimales', () => {
    expect(() => calcularTotalLinea({ cantidad: 1, precio_unit_snapshot: 1500.5 })).toThrow(ErrorDeDinero);
  });
});

describe('sumarLineas', () => {
  it('el total de una cuenta es la suma simple de sus líneas', () => {
    const total = sumarLineas([
      { cantidad: 2, precio_unit_snapshot: 4500 },
      { cantidad: 1, precio_unit_snapshot: 6500, opciones: [{ precio_extra_snapshot: 500 }] },
      { cantidad: 3, precio_unit_snapshot: 1800 },
    ]);
    expect(total).toBe(9000 + 7000 + 5400);
  });

  it('las líneas anuladas no suman', () => {
    const total = sumarLineas([
      { cantidad: 1, precio_unit_snapshot: 5000 },
      { cantidad: 1, precio_unit_snapshot: 5000, anulada: true },
    ]);
    expect(total).toBe(5000);
  });

  it('una cuenta sin líneas vale 0', () => {
    expect(sumarLineas([])).toBe(0);
  });
});

describe('totalizadorDeLinea — separación contable', () => {
  it('la comida de una cuenta de salón va a SALON', () => {
    expect(totalizadorDeLinea('SALON', false)).toBe('SALON');
  });

  it('la comida de una cuenta para llevar va a PARA_LLEVAR', () => {
    expect(totalizadorDeLinea('PARA_LLEVAR', false)).toBe('PARA_LLEVAR');
  });

  it('el envase va a ENVASES sin importar el canal de la cuenta', () => {
    expect(totalizadorDeLinea('SALON', true)).toBe('ENVASES');
    expect(totalizadorDeLinea('PARA_LLEVAR', true)).toBe('ENVASES');
  });

  it('EL CASO TRAMPA: al cliente del salón le sobró comida y se la lleva', () => {
    // Don Carlos come en el salón un casado de ₡4.500 y pide llevarse lo que sobró.
    // La mesera marca la línea con para_llevar = true → se agrega un envase de ₡200.
    //
    // La comida sigue siendo venta de SALÓN. Ni un colón se mueve a "para llevar".
    const cuenta = { canal: 'SALON' } as const;

    const lineas = [
      { es_envase: false, para_llevar: true, cantidad: 1, precio_unit_snapshot: 4500 },
      { es_envase: true, para_llevar: false, cantidad: 1, precio_unit_snapshot: 200 },
    ];

    // `para_llevar` NO entra en la clasificación. Ni siquiera se puede pasar:
    // la firma de totalizadorDeLinea no lo acepta.
    const totales = { SALON: 0, PARA_LLEVAR: 0, ENVASES: 0 };
    for (const linea of lineas) {
      totales[totalizadorDeLinea(cuenta.canal, linea.es_envase)] += calcularTotalLinea(linea);
    }

    expect(totales).toEqual({ SALON: 4500, PARA_LLEVAR: 0, ENVASES: 200 });
  });

  it('una cuenta PARA_LLEVAR manda toda su comida a PARA_LLEVAR y sus envases a ENVASES', () => {
    const lineas = [
      { es_envase: false, cantidad: 2, precio_unit_snapshot: 4500 },
      { es_envase: false, cantidad: 1, precio_unit_snapshot: 3000 },
      { es_envase: true, cantidad: 3, precio_unit_snapshot: 200 },
    ];

    const totales = { SALON: 0, PARA_LLEVAR: 0, ENVASES: 0 };
    for (const linea of lineas) {
      totales[totalizadorDeLinea('PARA_LLEVAR', linea.es_envase)] += calcularTotalLinea(linea);
    }

    expect(totales).toEqual({ SALON: 0, PARA_LLEVAR: 12000, ENVASES: 600 });
  });
});
