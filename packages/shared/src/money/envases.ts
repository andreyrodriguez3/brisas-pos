import type { CanalCuenta } from '../types/enums';
import type { Colones } from '../types/entidades';
import { exigirColones } from './colones';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CUÁNTOS ENVASES COBRAR.  Y por qué eso no cambia a dónde va la venta.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El envase plástico se cobra a ₡200 por unidad, precio único, en dos casos:
 *
 *   1. La cuenta es de canal PARA_LLEVAR: alguien llamó o llegó al mostrador a
 *      pedir para recoger. Se cobra un envase por platillo, automáticamente.
 *
 *   2. A un cliente del SALÓN le sobró comida y pide llevársela. La mesera marca
 *      esas líneas con `para_llevar` y se cobra un envase por cada una.
 *
 * ⚠️ Y acá está lo que hay que tener clarísimo: en el caso 2, marcar la línea
 * SOLO agrega este cargo. Esa comida se vendió en el salón y se sirvió en el
 * salón — sigue contando como venta de salón, completa. La clasificación la
 * hace `cuenta.canal`, siempre (ver `totalizadorDeLinea`).
 *
 * Esta función devuelve una CANTIDAD, no un totalizador. No mueve ni un colón
 * de bolsa.
 */

export interface LineaParaEnvase {
  cantidad: number;
  /** Solo dispara el cargo del envase. NO clasifica ingresos. */
  para_llevar: boolean;
  /** Las líneas de envase no generan más envases, obviamente. */
  es_envase: boolean;
  /** Una línea anulada no se cobra ni arrastra envase. */
  anulada?: boolean;
}

/**
 * Cuántos envases hay que cobrar por estas líneas.
 *
 * DECISIÓN: en una cuenta PARA_LLEVAR cuentan TODAS las líneas, también las
 * bebidas. El plan lo dice así ("un envase por platillo... y la caja puede
 * ajustar la cantidad"), y el sistema no tiene cómo saber qué necesita envase y
 * qué no sin inventarle un campo al menú. El ajuste manual de caja cubre el
 * caso de los tres frescos que no llevaban envase.
 */
export function envasesNecesarios(
  canalDeLaCuenta: CanalCuenta,
  lineas: ReadonlyArray<LineaParaEnvase>,
): number {
  return lineas.reduce((total, linea) => {
    if (linea.anulada || linea.es_envase) return total;

    const necesita = canalDeLaCuenta === 'PARA_LLEVAR' || linea.para_llevar;
    return necesita ? total + linea.cantidad : total;
  }, 0);
}

/** Lo que suman esos envases. Va siempre al totalizador ENVASES. */
export function totalEnvases(cantidad: number, precioEnvase: Colones): Colones {
  exigirColones(precioEnvase, 'precio del envase');
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new Error(`La cantidad de envases debe ser un entero >= 0, llegó: ${cantidad}`);
  }
  return cantidad * precioEnvase;
}
