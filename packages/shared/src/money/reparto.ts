import type { Colones } from '../types/entidades';
import { exigirColones, exigirEnteroPositivo } from './colones';
import { dividirEnPartes, repartirPorPesos } from './dividir';

/**
 * Las tres reglas de reparto entre meseras.
 *
 * La dueña todavía no decidió cuál manda cuando hay dos o más meseras en el mismo
 * turno, así que el sistema implementa las tres y el cierre SIEMPRE muestra las
 * tres cifras lado a lado. Cuál se aplica lo dice `configuracion.REGLA_REPARTO`.
 *
 * Esto es un REPORTE sobre datos que el sistema ya tiene, no un motor de nómina.
 * El sistema calcula y muestra; la entrega del dinero la hace la caja a mano.
 */

/** Ventas de salón atribuidas a una mesera (cuentas que ella abrió). */
export interface VentasMesera {
  usuario_id: number;
  ventas: Colones;
}

/** Horas trabajadas por una mesera en el turno. Admite fracciones (6.5 = 6 h 30 min). */
export interface HorasMesera {
  usuario_id: number;
  horas: number;
}

export interface ParteReparto {
  usuario_id: number;
  monto: Colones;
}

/**
 * REGLA A — ATRIBUCIÓN (por defecto).
 * Cada mesera se lleva el total de las cuentas que ella abrió.
 *
 * Es el caso que describió la dueña: "una mesera va un día de 11 a 5 y todo va a
 * ser para ella". Con una sola mesera, sus cuentas son todas las cuentas.
 */
export function repartirPorAtribucion(ventasPorMesera: ReadonlyArray<VentasMesera>): ParteReparto[] {
  return ventasPorMesera.map(({ usuario_id, ventas }) => {
    exigirColones(ventas, `ventas de la mesera ${usuario_id}`);
    return { usuario_id, monto: ventas };
  });
}

/**
 * REGLA B — HORAS.
 * El total del turno en proporción a las horas trabajadas por cada una.
 *
 * Las horas se convierten a minutos enteros antes de repartir: el reparto nunca
 * depende de aritmética de punto flotante. Las partes suman EXACTAMENTE `total`.
 *
 * Si nadie tiene horas registradas, cae en partes iguales (ver `repartirPorPesos`).
 */
export function repartirPorHoras(
  total: Colones,
  horasPorMesera: ReadonlyArray<HorasMesera>,
): ParteReparto[] {
  exigirColones(total, 'total del turno');
  if (horasPorMesera.length === 0) return [];

  const minutos = horasPorMesera.map(({ usuario_id, horas }) => {
    if (typeof horas !== 'number' || !Number.isFinite(horas) || horas < 0) {
      throw new Error(`Las horas de la mesera ${usuario_id} deben ser un número >= 0, llegó: ${horas}`);
    }
    return Math.round(horas * 60);
  });

  const montos = repartirPorPesos(total, minutos);
  return horasPorMesera.map(({ usuario_id }, i) => ({ usuario_id, monto: montos[i] }));
}

/**
 * REGLA C — PARTES IGUALES.
 * El total del turno dividido entre las meseras que trabajaron.
 * Los colones sobrantes van a la primera parte.
 */
export function repartirPartesIguales(total: Colones, nMeseras: number): Colones[] {
  exigirEnteroPositivo(nMeseras, 'nMeseras', 1);
  return dividirEnPartes(total, nMeseras);
}
