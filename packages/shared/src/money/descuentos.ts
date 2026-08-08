import type { TipoDescuento } from '../types/enums';
import type { Colones } from '../types/entidades';
import { exigirColones } from './colones';

/**
 * Descuentos y cortesías.
 *
 * INVARIANTE 8: acá no hay aritmética de impuestos. Los precios del menú ya
 * traen el IVA 13 % y el 10 % de servicio, así que un descuento se calcula
 * sobre el total tal cual, sin desarmar nada.
 */

export interface DescuentoAplicable {
  tipo: TipoDescuento;
  /** Colones si MONTO · porcentaje 0–100 si PORCENTAJE · se ignora si CORTESIA. */
  valor: number;
}

/**
 * Cuánto descuenta uno solo, sobre el monto que quede por cobrar.
 *
 * Nunca devuelve más que `base`: un descuento no puede dejar la cuenta en
 * negativo, ni siquiera si la caja teclea ₡50.000 en una cuenta de ₡8.000.
 *
 * El porcentaje se redondea al colón más cercano. Es lo que la dueña espera al
 * hacer la cuenta a mano: el 10 % de ₡8.335 son ₡834, no ₡833,5.
 */
export function calcularDescuento(base: Colones, descuento: DescuentoAplicable): Colones {
  exigirColones(base, 'base');

  switch (descuento.tipo) {
    case 'CORTESIA':
      // La casa invita: se va todo lo que quedaba.
      return base;

    case 'PORCENTAJE': {
      if (!Number.isFinite(descuento.valor) || descuento.valor < 0 || descuento.valor > 100) {
        throw new Error(`El porcentaje debe estar entre 0 y 100, llegó: ${descuento.valor}`);
      }
      return Math.min(base, Math.round((base * descuento.valor) / 100));
    }

    case 'MONTO':
      exigirColones(descuento.valor, 'valor del descuento');
      return Math.min(base, descuento.valor);

    default: {
      const tipo: never = descuento.tipo;
      throw new Error(`Tipo de descuento desconocido: ${String(tipo)}`);
    }
  }
}

/**
 * Aplica varios descuentos, uno tras otro.
 *
 * DECISIÓN: cada uno se calcula sobre lo que quedaba después del anterior, no
 * sobre el total original. Así la suma de los descuentos nunca puede pasarse
 * del total — dos descuentos del 60 % sobre el original darían 120 % y la
 * cuenta quedaría en negativo.
 *
 * Devuelve también el detalle: la pantalla de caja muestra cuánto descontó cada
 * uno, no solo el número final, porque cada descuento lleva su motivo.
 */
export function aplicarDescuentos(
  total: Colones,
  descuentos: ReadonlyArray<DescuentoAplicable>,
): { descuento: Colones; neto: Colones; detalle: Colones[] } {
  exigirColones(total, 'total');

  let restante = total;
  const detalle: Colones[] = [];

  for (const d of descuentos) {
    const monto = calcularDescuento(restante, d);
    detalle.push(monto);
    restante -= monto;
  }

  return { descuento: total - restante, neto: restante, detalle };
}
