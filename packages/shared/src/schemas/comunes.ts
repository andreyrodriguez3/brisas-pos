import { z } from 'zod';
import { HEX_PALETA_MESERAS } from '../constants/paleta';

/**
 * Piezas Zod reutilizables. Backend y frontend validan con los MISMOS schemas:
 * lo que el formulario acepta es exactamente lo que el endpoint acepta.
 */

/**
 * Entero de colones. Nunca decimales — ver INVARIANTE 1.
 *
 * El tope superior no es un límite de negocio: es defensivo. La interfaz
 * nunca dejaría escribir un monto así, pero cualquiera en la LAN puede
 * llamarle a la API con curl (ver la nota de RolesGuard), y el backend es
 * el único lugar que de verdad lo impide. ₡10.000.000 es generoso de sobra
 * para una cuenta de este restaurante — el límite está para atajar un
 * monto absurdo, no para acotar uno real.
 */
export const zColones = z
  .number({ invalid_type_error: 'El monto debe ser un número' })
  .int('El dinero se maneja en colones enteros, sin decimales')
  .min(0, 'El monto no puede ser negativo')
  .max(10_000_000, 'Ese monto es demasiado alto');

export const zCantidad = z
  .number()
  .int('La cantidad debe ser un entero')
  .min(1, 'Mínimo 1')
  .max(500, 'Esa cantidad es demasiado alta');

export const zId = z.number().int().positive();

export const zPin = z
  .string()
  .regex(/^\d{4}$/, 'El PIN son exactamente 4 dígitos');

export const zColorMesera = z
  .string()
  .refine((hex) => HEX_PALETA_MESERAS.includes(hex.toUpperCase()), {
    message: 'El color debe salir de la paleta de meseras',
  });

/** Motivo obligatorio: descuentos, cortesías, anulaciones. Todo queda auditado. */
export const zMotivo = z
  .string()
  .trim()
  .min(3, 'El motivo es obligatorio y debe explicar qué pasó')
  .max(500, 'El motivo es demasiado largo');

export const zNota = z.string().trim().max(200, 'La nota es demasiado larga').optional();

/** Teléfono de Costa Rica: 8 dígitos, tolerando espacios y guiones al escribir. */
export const zTelefono = z
  .string()
  .trim()
  .transform((t) => t.replace(/[\s-]/g, ''))
  .refine((t) => /^\d{8}$/.test(t), 'El teléfono son 8 dígitos');

export const zFechaISO = z.string().datetime({ offset: true }).or(z.string().datetime());
