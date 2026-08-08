import type { Colones } from '../types/entidades';

/**
 * Reglas base del dinero en Brisas POS.
 *
 * INVARIANTE 1: todo monto es un entero de colones. Nunca float.
 * El colón no tiene subdivisión en uso, así que no hay razón para decimales —
 * y los decimales binarios harían que 0.1 + 0.2 !== 0.3 al cerrar el día.
 *
 * INVARIANTE 8: no hay aritmética de impuestos. Los precios del menú ya incluyen
 * el IVA 13% y el 10% de servicio. El total de una cuenta es la suma de sus líneas.
 */

export class ErrorDeDinero extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeDinero';
  }
}

/** true si `valor` es un entero de colones válido (>= 0 y dentro del rango seguro). */
export function esColonesValido(valor: unknown): valor is Colones {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0;
}

/** Lanza `ErrorDeDinero` si `valor` no es un entero de colones >= 0. */
export function exigirColones(valor: unknown, nombre = 'monto'): asserts valor is Colones {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErrorDeDinero(`${nombre} debe ser un número, llegó: ${String(valor)}`);
  }
  if (!Number.isInteger(valor)) {
    throw new ErrorDeDinero(
      `${nombre} debe ser un entero de colones, llegó: ${valor}. ` +
        'El dinero nunca se representa con decimales en este sistema.',
    );
  }
  if (valor < 0) {
    throw new ErrorDeDinero(`${nombre} no puede ser negativo, llegó: ${valor}`);
  }
  if (!Number.isSafeInteger(valor)) {
    throw new ErrorDeDinero(`${nombre} excede el rango de enteros seguros: ${valor}`);
  }
}

/** Lanza si `valor` no es un entero >= `minimo`. Para cantidades, partes, etc. */
export function exigirEnteroPositivo(valor: unknown, nombre: string, minimo = 1): asserts valor is number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo) {
    throw new ErrorDeDinero(`${nombre} debe ser un entero >= ${minimo}, llegó: ${String(valor)}`);
  }
}

/**
 * Formato costarricense para pantalla: 8334 → "₡8.334".
 * Separador de miles con punto, sin decimales.
 */
export function formatearColones(valor: Colones, conSimbolo = true): string {
  const negativo = valor < 0;
  const entero = Math.abs(Math.trunc(valor));
  const conPuntos = entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}${conSimbolo ? '₡' : ''}${conPuntos}`;
}
