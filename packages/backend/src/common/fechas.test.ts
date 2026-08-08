import { describe, expect, it } from 'vitest';
import { OFFSET_CR_MINUTOS, diaLocal, horasTrabajadas, minutosDesde } from './fechas';

describe('diaLocal', () => {
  it('Costa Rica es UTC-6 todo el año, sin horario de verano', () => {
    expect(OFFSET_CR_MINUTOS).toBe(-360);
  });

  it('devuelve el día en formato YYYY-MM-DD', () => {
    expect(diaLocal(new Date('2026-08-06T18:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('EL CASO TRAMPA: un pedido de la noche NO cae en el día siguiente', () => {
    // 7 p.m. del 6 de agosto en Costa Rica = 01:00 UTC del 7 de agosto.
    // Si se usara UTC, ese pedido caería en el turno del día siguiente y el
    // cierre no cuadraría con lo que vio la caja.
    const pedidoDeLaNoche = new Date('2026-08-07T01:00:00Z');
    expect(diaLocal(pedidoDeLaNoche)).toBe('2026-08-06');
  });

  it('el corte de día es a la medianoche de Costa Rica, no a la de UTC', () => {
    // 23:59 CR del 6 → todavía es el 6.
    expect(diaLocal(new Date('2026-08-07T05:59:00Z'))).toBe('2026-08-06');
    // 00:01 CR del 7 → ya es el 7.
    expect(diaLocal(new Date('2026-08-07T06:01:00Z'))).toBe('2026-08-07');
  });

  it('el almuerzo cae en el día correcto', () => {
    // Mediodía en Costa Rica = 18:00 UTC.
    expect(diaLocal(new Date('2026-08-06T18:00:00Z'))).toBe('2026-08-06');
  });
});

describe('minutosDesde', () => {
  it('cuenta minutos enteros hacia abajo', () => {
    const desde = new Date('2026-08-06T18:00:00Z');
    expect(minutosDesde(desde, new Date('2026-08-06T18:09:59Z'))).toBe(9);
    expect(minutosDesde(desde, new Date('2026-08-06T18:10:00Z'))).toBe(10);
    expect(minutosDesde(desde, new Date('2026-08-06T18:20:00Z'))).toBe(20);
  });

  it('una comanda recién entrada tiene 0 minutos', () => {
    const ahora = new Date('2026-08-06T18:00:00Z');
    expect(minutosDesde(ahora, ahora)).toBe(0);
  });
});

describe('horasTrabajadas', () => {
  it('calcula el turno de la dueña: de 11 a 5', () => {
    // "una mesera va un día de 11 a 5 y todo va a ser para ella"
    const entrada = new Date('2026-08-06T17:00:00Z'); // 11 a.m. CR
    const salida = new Date('2026-08-06T23:00:00Z'); // 5 p.m. CR
    expect(horasTrabajadas(entrada, salida)).toBe(6);
  });

  it('admite fracciones de hora', () => {
    const entrada = new Date('2026-08-06T17:00:00Z');
    const salida = new Date('2026-08-06T22:30:00Z');
    expect(horasTrabajadas(entrada, salida)).toBe(5.5);
  });

  it('sin hora de salida cuenta hasta ahora — la mesera sigue en el turno', () => {
    const entrada = new Date(Date.now() - 2 * 3_600_000);
    expect(horasTrabajadas(entrada, null)).toBeCloseTo(2, 1);
  });

  it('nunca devuelve horas negativas', () => {
    const entrada = new Date('2026-08-06T23:00:00Z');
    const salida = new Date('2026-08-06T17:00:00Z');
    expect(horasTrabajadas(entrada, salida)).toBe(0);
  });
});
