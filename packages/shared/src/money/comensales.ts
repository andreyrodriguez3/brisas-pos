import type { Colones } from '../types/entidades';
import { exigirColones } from './colones';
import { repartirPorPesos } from './dividir';

/**
 * "Cada quien lo suyo": repartir una cuenta línea por línea entre los comensales.
 *
 * `linea_comensal.fraccion` es un `Float` y **no es dinero**. Sirve para decir
 * "esta picada la comparten tres" (0,333… cada uno). El dinero se reparte con
 * `repartirPorPesos` sobre enteros, para que las partes sumen exactamente el
 * total de la línea y no aparezca un colón de la nada.
 */

export interface FraccionComensal {
  comensal_id: number;
  /** Parte de la línea que le toca. Las de una línea suman 1. */
  fraccion: number;
}

export interface LineaAsignable {
  linea_id: number;
  /** Total de la línea, ya calculado con los precios congelados. */
  total: Colones;
  asignaciones: ReadonlyArray<FraccionComensal>;
}

/**
 * Las fracciones son floats; los pesos del reparto tienen que ser enteros.
 * Se escalan a millonésimas: 1/3 → 333.333. `repartirPorPesos` normaliza por la
 * suma, así que no importa que 3 × 333.333 no dé exactamente 1.000.000.
 */
const ESCALA_FRACCION = 1_000_000;

/**
 * Reparte el monto de UNA línea entre sus comensales.
 * Devuelve los montos en el mismo orden en que vinieron las asignaciones.
 */
export function repartirLinea(
  total: Colones,
  asignaciones: ReadonlyArray<FraccionComensal>,
): Colones[] {
  exigirColones(total, 'total de la línea');
  if (asignaciones.length === 0) return [];

  const pesos = asignaciones.map((a) => {
    if (!Number.isFinite(a.fraccion) || a.fraccion < 0) {
      throw new Error(`La fracción del comensal ${a.comensal_id} no es válida: ${a.fraccion}`);
    }
    return Math.round(a.fraccion * ESCALA_FRACCION);
  });

  return repartirPorPesos(total, pesos);
}

/**
 * Lo que le toca pagar a cada comensal, sumando su parte de cada línea.
 *
 * La suma de todos los comensales es EXACTAMENTE la suma de las líneas
 * asignadas: el redondeo se resuelve línea por línea, nunca al final.
 */
export function totalesPorComensal(
  lineas: ReadonlyArray<LineaAsignable>,
): Map<number, Colones> {
  const totales = new Map<number, Colones>();

  for (const linea of lineas) {
    const montos = repartirLinea(linea.total, linea.asignaciones);
    linea.asignaciones.forEach((a, i) => {
      totales.set(a.comensal_id, (totales.get(a.comensal_id) ?? 0) + montos[i]);
    });
  }

  return totales;
}

/**
 * Las líneas que todavía no se le asignaron a nadie.
 *
 * El cobro no se puede cerrar con líneas sueltas — se cobraría de menos y nadie
 * se daría cuenta hasta el cierre del día. La pantalla muestra el contador.
 */
export function lineasSinAsignar(
  lineas: ReadonlyArray<LineaAsignable>,
): ReadonlyArray<LineaAsignable> {
  return lineas.filter((l) => l.asignaciones.length === 0);
}

/** Fracciones iguales para repartir una línea entre los comensales elegidos. */
export function fraccionesIguales(comensalesIds: readonly number[]): FraccionComensal[] {
  if (comensalesIds.length === 0) return [];
  const fraccion = 1 / comensalesIds.length;
  return comensalesIds.map((comensal_id) => ({ comensal_id, fraccion }));
}
