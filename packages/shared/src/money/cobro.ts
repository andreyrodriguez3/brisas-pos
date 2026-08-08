import type { Colones } from '../types/entidades';
import { exigirColones } from './colones';
import { aplicarDescuentos, type DescuentoAplicable } from './descuentos';

/**
 * El estado de cobro de una cuenta, en un solo lugar.
 *
 * Backend y frontend llaman a esta misma función: el saldo que ve la caja en
 * pantalla es exactamente el que el servidor usa para decidir si la cuenta
 * quedó saldada. Dos aritméticas distintas serían dos verdades sobre la plata.
 */

export interface ResumenCobro {
  /** Suma de las líneas no anuladas, con sus precios congelados. */
  subtotal: Colones;
  /** Lo que descuentan los descuentos y cortesías, ya acumulado. */
  descuento: Colones;
  /** Lo que hay que cobrar: subtotal − descuento. */
  total: Colones;
  /** Lo ya registrado como pagado. Puede ser parcial. */
  pagado: Colones;
  /** Lo que falta. Cero = cuenta saldada. */
  saldo: Colones;
  /** Cuánto descontó cada descuento, en el orden en que se aplicaron. */
  detalleDescuentos: Colones[];
}

export function resumirCobro(
  subtotal: Colones,
  descuentos: ReadonlyArray<DescuentoAplicable>,
  pagos: ReadonlyArray<{ monto: Colones }>,
): ResumenCobro {
  exigirColones(subtotal, 'subtotal');

  const { descuento, neto, detalle } = aplicarDescuentos(subtotal, descuentos);

  const pagado = pagos.reduce((acc, p) => {
    exigirColones(p.monto, 'monto del pago');
    return acc + p.monto;
  }, 0);

  return {
    subtotal,
    descuento,
    total: neto,
    pagado,
    // Nunca negativo: si se registró de más, el saldo es 0 y la diferencia se ve
    // comparando `pagado` con `total`. Un saldo negativo en pantalla no le dice
    // nada a nadie.
    saldo: Math.max(0, neto - pagado),
    detalleDescuentos: detalle,
  };
}

/** La cuenta está saldada: se puede cerrar. */
export function estaSaldada(resumen: ResumenCobro): boolean {
  return resumen.pagado >= resumen.total;
}
