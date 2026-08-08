import type { CanalCuenta, Totalizador } from '../types/enums';
import type { Colones } from '../types/entidades';
import { exigirColones, exigirEnteroPositivo } from './colones';

/**
 * Lo mínimo que necesita una línea para calcular su total.
 * Se acepta una forma estructural para poder cobrar tanto una línea ya guardada
 * como uno de los ítems del carrito que todavía no llegó a la base de datos.
 */
export interface LineaCobrable {
  cantidad: number;
  /** Precio congelado al crear la línea. */
  precio_unit_snapshot: Colones;
  opciones?: ReadonlyArray<{ precio_extra_snapshot: Colones }>;
  anulada?: boolean;
}

/**
 * Total de una línea: (precio congelado + extras congelados) × cantidad.
 *
 * INVARIANTE 2: se usan EXCLUSIVAMENTE los precios snapshot de la línea.
 * Nunca se lee el menú para recalcular una cuenta existente. Si la dueña sube
 * un precio a media tarde, las cuentas ya abiertas no cambian.
 *
 * INVARIANTE 8: no se suma IVA ni servicio. Ya vienen dentro del precio.
 *
 * Una línea anulada vale 0 (INVARIANTE 4: no se borra, se marca).
 */
export function calcularTotalLinea(linea: LineaCobrable): Colones {
  if (linea.anulada) return 0;

  exigirEnteroPositivo(linea.cantidad, 'cantidad', 1);
  exigirColones(linea.precio_unit_snapshot, 'precio_unit_snapshot');

  const extras = (linea.opciones ?? []).reduce((acc, opcion) => {
    exigirColones(opcion.precio_extra_snapshot, 'precio_extra_snapshot');
    return acc + opcion.precio_extra_snapshot;
  }, 0);

  return (linea.precio_unit_snapshot + extras) * linea.cantidad;
}

/** Suma de varias líneas. El total de una cuenta es exactamente esto. */
export function sumarLineas(lineas: ReadonlyArray<LineaCobrable>): Colones {
  return lineas.reduce((acc, linea) => acc + calcularTotalLinea(linea), 0);
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  A QUÉ TOTALIZADOR VA UNA LÍNEA.  Punto único de la separación contable.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * INVARIANTE 3. Fijate en la firma: esta función NO recibe `para_llevar`.
 * No es un olvido — es el punto entero de la función.
 *
 *   · `cuenta.canal`            → CLASIFICA INGRESOS (SALON / PARA_LLEVAR)
 *   · `pedido_linea.para_llevar` → SOLO dispara el cargo del envase
 *
 * Que a un cliente del salón le sobre medio casado y se lo lleve NO convierte
 * esa venta en "para llevar": se vendió en el salón y se sirvió en el salón.
 * Suma completa a `total_salon`, y aparte ₡200 a `total_envases`.
 *
 * Si en algún momento necesitás pasarle `para_llevar` a esta función, la lógica
 * que estás escribiendo está mal. Pará y releé la sección 5.7 del plan de trabajo.
 */
export function totalizadorDeLinea(canalDeLaCuenta: CanalCuenta, esEnvase: boolean): Totalizador {
  if (esEnvase) return 'ENVASES';
  return canalDeLaCuenta === 'PARA_LLEVAR' ? 'PARA_LLEVAR' : 'SALON';
}
