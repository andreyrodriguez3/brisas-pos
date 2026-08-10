import { z } from 'zod';
import { FormaPago, ModoDivision, TipoDescuento } from '../types/enums';
import { zColones, zId, zMotivo } from './comunes';

/**
 * Cobro, descuentos y división de factura.
 *
 * ⚠️ El sistema NO procesa cobros. Calcula el monto y registra qué se cobró;
 * el datáfono, el SINPE y el efectivo siguen funcionando aparte, igual que hoy.
 * `forma_pago` se guarda como dato informativo y nada más.
 */

// ── Descuentos y cortesías ──────────────────────────────────────────────────

/**
 * El motivo es obligatorio SIEMPRE. Un descuento sin explicación es un hueco en
 * la caja que nadie puede reconstruir tres semanas después.
 */
export const aplicarDescuentoSchema = z
  .object({
    tipo: z.nativeEnum(TipoDescuento),
    /**
     * Colones si MONTO · 0–100 si PORCENTAJE · se ignora si CORTESIA.
     * Reutiliza `zColones` para heredar su tope superior — un porcentaje
     * nunca se acerca a ese límite, así que no interfiere con el 0–100 que
     * se valida abajo.
     */
    valor: zColones.default(0),
    motivo: zMotivo,
  })
  .superRefine((datos, ctx) => {
    if (datos.tipo === TipoDescuento.PORCENTAJE && datos.valor > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valor'],
        message: 'Un porcentaje no puede pasar de 100',
      });
    }
    if (datos.tipo !== TipoDescuento.CORTESIA && datos.valor <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valor'],
        message: 'Un descuento de cero no descuenta nada',
      });
    }
  });
export type AplicarDescuentoDto = z.infer<typeof aplicarDescuentoSchema>;

// ── División ────────────────────────────────────────────────────────────────

export const fijarDivisionSchema = z
  .object({
    modo: z.nativeEnum(ModoDivision),
    /** Solo en PARTES_IGUALES: en cuántas se parte. */
    n_partes: z.number().int().min(2, 'Son al menos 2 partes').max(20).optional().nullable(),
  })
  .superRefine((datos, ctx) => {
    if (datos.modo === ModoDivision.PARTES_IGUALES && !datos.n_partes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['n_partes'],
        message: 'Decí en cuántas partes se divide',
      });
    }
  });
export type FijarDivisionDto = z.infer<typeof fijarDivisionSchema>;

/** Comensales de la cuenta. Con `id` se renombra; sin `id` se crea. */
export const guardarComensalesSchema = z.object({
  comensales: z
    .array(
      z.object({
        id: zId.optional(),
        etiqueta: z.string().trim().min(1, 'Poné un nombre o etiqueta').max(40),
      }),
    )
    .min(1, 'Hace falta al menos un comensal')
    .max(20),
});
export type GuardarComensalesDto = z.infer<typeof guardarComensalesSchema>;

/**
 * A quién le toca una línea.
 *
 * `partes` cubre los dos casos del plan con una sola forma:
 *   · compartir en partes iguales  → todos con partes = 1
 *   · repartir por cantidad        → 3 cervezas, 2 a Juan y 1 a Ana → partes 2 y 1
 *
 * La fracción la calcula el servidor (`partes` ÷ suma). El cliente no manda
 * fracciones: mandar 0,333 desde tres celulares distintos no sumaría 1.
 */
export const asignarLineasSchema = z.object({
  asignaciones: z.array(
    z.object({
      linea_id: zId,
      comensales: z
        .array(
          z.object({ comensal_id: zId, partes: z.number().int().min(1).max(50).default(1) }),
        )
        // Vacío = desasignar la línea. Es una acción válida: la caja se
        // equivocó y la quiere volver a repartir.
        .max(20),
    }),
  ),
});
export type AsignarLineasDto = z.infer<typeof asignarLineasSchema>;

// ── Pagos ───────────────────────────────────────────────────────────────────

export const registrarPagoSchema = z.object({
  monto: zColones.min(1, 'El pago tiene que ser mayor que cero'),
  forma_pago: z.nativeEnum(FormaPago).default(FormaPago.EFECTIVO),
  /** Qué parte se está cobrando, cuando la cuenta está dividida. */
  parte_num: z.number().int().min(1).optional().nullable(),
  /**
   * Cobrar aunque cocina no haya entregado todo. La caja ve la advertencia y
   * decide; el forzado queda auditado con su motivo.
   */
  forzar: z.boolean().default(false),
  motivo: z.string().trim().max(200).optional(),
});
export type RegistrarPagoDto = z.infer<typeof registrarPagoSchema>;
