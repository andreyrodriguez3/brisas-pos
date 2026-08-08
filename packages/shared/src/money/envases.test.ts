import { describe, expect, it } from 'vitest';
import { envasesNecesarios, totalEnvases } from './envases';
import { calcularTotalLinea, totalizadorDeLinea } from './lineas';

const platillo = (cantidad: number, para_llevar = false) => ({
  cantidad,
  para_llevar,
  es_envase: false,
});

describe('envasesNecesarios — cuenta de SALÓN', () => {
  it('sin líneas marcadas no cobra ningún envase', () => {
    expect(envasesNecesarios('SALON', [platillo(2), platillo(1)])).toBe(0);
  });

  it('cobra un envase por cada platillo que el cliente se lleva', () => {
    expect(envasesNecesarios('SALON', [platillo(2), platillo(1, true)])).toBe(1);
  });

  it('una línea de cantidad 3 marcada lleva 3 envases', () => {
    expect(envasesNecesarios('SALON', [platillo(3, true)])).toBe(3);
  });

  it('las líneas de envase no generan más envases', () => {
    expect(
      envasesNecesarios('SALON', [
        platillo(1, true),
        { cantidad: 1, para_llevar: false, es_envase: true },
      ]),
    ).toBe(1);
  });

  it('una línea anulada no arrastra envase', () => {
    expect(
      envasesNecesarios('SALON', [{ cantidad: 2, para_llevar: true, es_envase: false, anulada: true }]),
    ).toBe(0);
  });
});

describe('envasesNecesarios — cuenta PARA_LLEVAR', () => {
  it('cobra un envase por platillo, sin que nadie marque nada', () => {
    expect(envasesNecesarios('PARA_LLEVAR', [platillo(2), platillo(1)])).toBe(3);
  });

  it('marcar la línea no cambia nada: ya contaba', () => {
    expect(envasesNecesarios('PARA_LLEVAR', [platillo(2, true), platillo(1, false)])).toBe(3);
  });

  it('sin líneas no cobra envases', () => {
    expect(envasesNecesarios('PARA_LLEVAR', [])).toBe(0);
  });
});

describe('totalEnvases', () => {
  it('multiplica cantidad por el precio único', () => {
    expect(totalEnvases(3, 200)).toBe(600);
  });

  it('cero envases valen cero', () => {
    expect(totalEnvases(0, 200)).toBe(0);
  });

  it('rechaza precios con decimales', () => {
    expect(() => totalEnvases(1, 200.5)).toThrow();
  });

  it('rechaza cantidades negativas o con decimales', () => {
    expect(() => totalEnvases(-1, 200)).toThrow();
    expect(() => totalEnvases(1.5, 200)).toThrow();
  });
});

describe('EL CASO TRAMPA COMPLETO — de punta a punta', () => {
  it('a Don Carlos le sobró medio casado: ₡200 de envase y ni un colón fuera de salón', () => {
    // Don Carlos come en el SALÓN: un casado de ₡4.500 y un fresco de ₡1.300.
    // Pide llevarse lo que le sobró del casado, así que la mesera marca esa
    // línea. El sistema agrega un envase de ₡200.
    const canal = 'SALON' as const;

    const lineasDelPedido = [
      { es_envase: false, para_llevar: true, cantidad: 1, precio_unit_snapshot: 4500 },
      { es_envase: false, para_llevar: false, cantidad: 1, precio_unit_snapshot: 1300 },
    ];

    const cuantosEnvases = envasesNecesarios(canal, lineasDelPedido);
    expect(cuantosEnvases).toBe(1);

    const lineaEnvase = {
      es_envase: true,
      para_llevar: false,
      cantidad: cuantosEnvases,
      precio_unit_snapshot: 200,
    };

    // Ahora se reparte todo en los tres totalizadores.
    const totales = { SALON: 0, PARA_LLEVAR: 0, ENVASES: 0 };
    for (const linea of [...lineasDelPedido, lineaEnvase]) {
      totales[totalizadorDeLinea(canal, linea.es_envase)] += calcularTotalLinea(linea);
    }

    // TODA la comida quedó en salón. El totalizador de para llevar ni se tocó.
    expect(totales).toEqual({ SALON: 5800, PARA_LLEVAR: 0, ENVASES: 200 });

    // Y el total que paga Don Carlos es la suma simple, sin impuestos aparte.
    expect(totales.SALON + totales.PARA_LLEVAR + totales.ENVASES).toBe(6000);
  });

  it('un pedido telefónico manda todo a para llevar, con sus envases aparte', () => {
    const canal = 'PARA_LLEVAR' as const;

    const lineasDelPedido = [
      { es_envase: false, para_llevar: false, cantidad: 2, precio_unit_snapshot: 4500 },
      { es_envase: false, para_llevar: false, cantidad: 1, precio_unit_snapshot: 3000 },
    ];

    const cuantosEnvases = envasesNecesarios(canal, lineasDelPedido);
    expect(cuantosEnvases).toBe(3);

    const lineaEnvase = {
      es_envase: true,
      para_llevar: false,
      cantidad: cuantosEnvases,
      precio_unit_snapshot: 200,
    };

    const totales = { SALON: 0, PARA_LLEVAR: 0, ENVASES: 0 };
    for (const linea of [...lineasDelPedido, lineaEnvase]) {
      totales[totalizadorDeLinea(canal, linea.es_envase)] += calcularTotalLinea(linea);
    }

    // Ni un colón en salón: esta venta no es atribuible a ninguna mesera.
    expect(totales).toEqual({ SALON: 0, PARA_LLEVAR: 12000, ENVASES: 600 });
  });

  it('dos cuentas idénticas en consumo van a bolsas distintas solo por su canal', () => {
    const lineas = [{ es_envase: false, cantidad: 1, precio_unit_snapshot: 4500 }];

    const salon = { SALON: 0, PARA_LLEVAR: 0, ENVASES: 0 };
    const llevar = { SALON: 0, PARA_LLEVAR: 0, ENVASES: 0 };

    for (const l of lineas) {
      salon[totalizadorDeLinea('SALON', l.es_envase)] += calcularTotalLinea(l);
      llevar[totalizadorDeLinea('PARA_LLEVAR', l.es_envase)] += calcularTotalLinea(l);
    }

    expect(salon.SALON).toBe(4500);
    expect(salon.PARA_LLEVAR).toBe(0);
    expect(llevar.SALON).toBe(0);
    expect(llevar.PARA_LLEVAR).toBe(4500);
  });
});
