import { describe, expect, it } from 'vitest';
import {
  minutosDeEspera,
  minutosParaRetiro,
  momentoDeReferencia,
  ordenarCola,
  urgenciaDeComanda,
} from './cola';

/** Un mediodía cualquiera, para no razonar con relojes reales. */
const T = (hhmm: string) => new Date(`2026-08-06T${hhmm}:00.000Z`).getTime();
const iso = (hhmm: string) => new Date(T(hhmm)).toISOString();

const salon = (consecutivo: number, entrada: string) => ({
  consecutivo_dia: consecutivo,
  creado_en: iso(entrada),
  hora_retiro: null,
});

const paraLlevar = (consecutivo: number, entrada: string, retiro: string) => ({
  consecutivo_dia: consecutivo,
  creado_en: iso(entrada),
  hora_retiro: iso(retiro),
});

describe('momentoDeReferencia', () => {
  it('una cuenta de salón se mide por su hora de entrada', () => {
    expect(momentoDeReferencia(salon(1, '12:00'))).toBe(T('12:00'));
  });

  it('una cuenta para llevar se mide por su HORA DE RETIRO, no por la de entrada', () => {
    expect(momentoDeReferencia(paraLlevar(1, '15:00', '18:00'))).toBe(T('18:00'));
  });
});

describe('ordenarCola', () => {
  it('lo más viejo va arriba', () => {
    const cola = ordenarCola([salon(3, '12:30'), salon(1, '12:00'), salon(2, '12:15')]);
    expect(cola.map((c) => c.consecutivo_dia)).toEqual([1, 2, 3]);
  });

  it('un pedido para llevar de las 6 no le gana el puesto a un almuerzo de las 12', () => {
    // Entró ANTES que el almuerzo, pero el cliente pasa a las 6: no es lo que sigue.
    const cola = ordenarCola([paraLlevar(1, '11:00', '18:00'), salon(2, '12:00')]);
    expect(cola.map((c) => c.consecutivo_dia)).toEqual([2, 1]);
  });

  it('cuando se acerca la hora de retiro, el pedido sube solo', () => {
    const cola = ordenarCola([salon(2, '17:50'), paraLlevar(1, '15:00', '17:45')]);
    expect(cola.map((c) => c.consecutivo_dia)).toEqual([1, 2]);
  });

  it('los empates se rompen por número de comanda: la lista no baila', () => {
    const cola = ordenarCola([salon(7, '12:00'), salon(4, '12:00'), salon(5, '12:00')]);
    expect(cola.map((c) => c.consecutivo_dia)).toEqual([4, 5, 7]);
  });

  it('no muta el arreglo que recibe', () => {
    const original = [salon(2, '12:30'), salon(1, '12:00')];
    ordenarCola(original);
    expect(original.map((c) => c.consecutivo_dia)).toEqual([2, 1]);
  });

  it('una cola vacía no explota', () => {
    expect(ordenarCola([])).toEqual([]);
  });
});

describe('minutosDeEspera', () => {
  it('cuenta los minutos completos desde que entró', () => {
    expect(minutosDeEspera(salon(1, '12:00'), T('12:07'))).toBe(7);
  });

  it('trunca: a los 6 minutos y medio todavía dice 6', () => {
    expect(minutosDeEspera(salon(1, '12:00'), T('12:00') + 6.5 * 60_000)).toBe(6);
  });

  it('nunca es negativo, aunque el reloj del dispositivo esté atrasado', () => {
    expect(minutosDeEspera(salon(1, '12:00'), T('11:55'))).toBe(0);
  });
});

describe('minutosParaRetiro', () => {
  it('es null cuando la cuenta no es para llevar', () => {
    expect(minutosParaRetiro(salon(1, '12:00'), T('12:10'))).toBeNull();
  });

  it('cuenta cuánto falta', () => {
    expect(minutosParaRetiro(paraLlevar(1, '15:00', '18:00'), T('17:30'))).toBe(30);
  });

  it('es negativo cuando la hora ya pasó', () => {
    expect(minutosParaRetiro(paraLlevar(1, '15:00', '18:00'), T('18:10'))).toBe(-10);
  });
});

describe('urgenciaDeComanda — salón: cuánto lleva esperando', () => {
  const comanda = salon(1, '12:00');

  it('recién entrada está en normal', () => {
    expect(urgenciaDeComanda(comanda, T('12:03'))).toBe('normal');
  });

  it('a los 10 minutos pasa a naranja', () => {
    expect(urgenciaDeComanda(comanda, T('12:10'))).toBe('alerta');
  });

  it('a los 20 minutos pasa a rojo', () => {
    expect(urgenciaDeComanda(comanda, T('12:20'))).toBe('urgente');
  });

  it('respeta los umbrales de configuración', () => {
    expect(urgenciaDeComanda(comanda, T('12:06'), { alerta: 5, urgente: 12 })).toBe('alerta');
    expect(urgenciaDeComanda(comanda, T('12:13'), { alerta: 5, urgente: 12 })).toBe('urgente');
  });
});

describe('urgenciaDeComanda — para llevar: cuánto falta para el retiro', () => {
  const comanda = paraLlevar(1, '15:00', '18:00');

  it('un pedido tomado con horas de anticipación NO está urgente', () => {
    // Lleva 2 horas y media "esperando": medirlo como el salón lo pintaría de
    // rojo sin ninguna razón y le quitaría sentido al semáforo entero.
    expect(urgenciaDeComanda(comanda, T('17:30'))).toBe('normal');
  });

  it('cuando faltan 20 minutos se pone naranja: ya debería estar en el fuego', () => {
    expect(urgenciaDeComanda(comanda, T('17:40'))).toBe('alerta');
  });

  it('cuando faltan 10 minutos se pone rojo', () => {
    expect(urgenciaDeComanda(comanda, T('17:50'))).toBe('urgente');
  });

  it('si la hora de retiro ya pasó, rojo: el cliente está en la puerta', () => {
    expect(urgenciaDeComanda(comanda, T('18:15'))).toBe('urgente');
  });
});
