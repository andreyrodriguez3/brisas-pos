/**
 * Reloj compartido.
 *
 * INVARIANTE 6: las horas las pone el SERVIDOR, nunca el cliente. Un celular con
 * la hora mal no puede desordenar la cola de cocina ni mover una venta de turno.
 * Ninguna fecha que llegue en un body se guarda como marca de tiempo del evento
 * (la única excepción es `hora_retiro`, que es una intención del cliente, no un
 * registro de cuándo pasó algo).
 */

/** Costa Rica es UTC-6 todo el año. No hay horario de verano. */
export const OFFSET_CR_MINUTOS = -6 * 60;

export function ahora(): Date {
  return new Date();
}

/**
 * Día calendario local en formato YYYY-MM-DD.
 *
 * Se usa como clave del turno y del consecutivo de comandas. Va en hora de Costa
 * Rica, no UTC: si no, a partir de las 6 p.m. los pedidos caerían en el día
 * siguiente y el cierre no cuadraría con lo que vio la caja.
 */
export function diaLocal(fecha: Date = ahora()): string {
  const local = new Date(fecha.getTime() + OFFSET_CR_MINUTOS * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Minutos transcurridos entre dos instantes. Para el temporizador de cocina. */
export function minutosDesde(desde: Date, hasta: Date = ahora()): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / 60_000);
}

/** Horas trabajadas entre entrada y salida. Si no hay salida, cuenta hasta ahora. */
export function horasTrabajadas(entrada: Date, salida: Date | null): number {
  const fin = salida ?? ahora();
  return Math.max(0, (fin.getTime() - entrada.getTime()) / 3_600_000);
}
