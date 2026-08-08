import { z } from 'zod';
import { zColones, zId } from './comunes';

/**
 * Menú. Nada se borra: se desactiva (INVARIANTE 4).
 *
 * ⚠️ Cambiar un precio acá NO afecta cuentas ya abiertas. Las líneas guardan
 * `precio_unit_snapshot` y jamás se recalculan desde el menú (INVARIANTE 2).
 */

export const crearCategoriaSchema = z.object({
  codigo: z.string().trim().min(2).max(40).toUpperCase(),
  nombre: z.string().trim().min(2),
  orden: z.number().int().min(0).default(0),
});
export type CrearCategoriaDto = z.infer<typeof crearCategoriaSchema>;

export const actualizarCategoriaSchema = crearCategoriaSchema
  .partial()
  .extend({ activo: z.boolean().optional() });
export type ActualizarCategoriaDto = z.infer<typeof actualizarCategoriaSchema>;

export const crearVarianteSchema = z.object({
  /**
   * Id de una variante que YA existe. Con él, editar la etiqueta la RENOMBRA;
   * sin él, se busca por etiqueta y si no existe se crea.
   *
   * Importa más de lo que parece: los 18 productos con rango de precio del menú
   * entraron con etiquetas supuestas ("Pequeño"/"Grande") que hay que corregir
   * con la dueña. Sin el id, corregirlas dejaría la variante vieja apagada y
   * crearía una nueva, duplicando la lista en vez de arreglarla.
   */
  id: zId.optional(),
  etiqueta: z.string().trim().min(1),
  /** null = sin precio cargado. El producto no se puede vender hasta que tenga uno. */
  precio_colones: zColones.nullable(),
  orden: z.number().int().min(0).default(0),
  /**
   * Si no viene, se deduce del precio: una variante sin precio no se puede
   * vender. Mandarlo explícito permite tener una variante con precio pero
   * apagada (ej.: "Grande" mientras no haya envase grande).
   */
  activo: z.boolean().optional(),
});
export type CrearVarianteDto = z.infer<typeof crearVarianteSchema>;

export const crearProductoSchema = z.object({
  categoria_id: zId,
  nombre_es: z.string().trim().min(2),
  nombre_en: z.string().trim().optional().nullable(),
  descripcion: z.string().trim().max(300).optional().nullable(),
  orden: z.number().int().min(0).default(0),
  es_envase: z.boolean().default(false),
  variantes: z.array(crearVarianteSchema).min(1, 'Un producto necesita al menos una variante'),
  grupos_opcion_ids: z.array(zId).default([]),
});
export type CrearProductoDto = z.infer<typeof crearProductoSchema>;

export const actualizarProductoSchema = crearProductoSchema.partial().extend({
  activo: z.boolean().optional(),
  /** "Agotado hoy": se muestra pero no se puede pedir. */
  agotado: z.boolean().optional(),
});
export type ActualizarProductoDto = z.infer<typeof actualizarProductoSchema>;

export const crearOpcionSchema = z.object({
  /** Igual que en las variantes: con id se renombra, sin id se crea. */
  id: zId.optional(),
  nombre: z.string().trim().min(1),
  precio_extra: zColones.default(0),
  activo: z.boolean().optional(),
});
export type CrearOpcionDto = z.infer<typeof crearOpcionSchema>;

export const actualizarOpcionSchema = crearOpcionSchema.partial();
export type ActualizarOpcionDto = z.infer<typeof actualizarOpcionSchema>;

export const crearGrupoOpcionSchema = z
  .object({
    codigo: z.string().trim().min(2).max(40).toUpperCase(),
    nombre: z.string().trim().min(2),
    obligatorio: z.boolean().default(false),
    min_sel: z.number().int().min(0).default(0),
    max_sel: z.number().int().min(1).default(1),
    opciones: z.array(crearOpcionSchema).min(1, 'Un grupo necesita al menos una opción'),
  })
  .refine((g) => g.max_sel >= g.min_sel, {
    message: 'El máximo de selecciones no puede ser menor que el mínimo',
    path: ['max_sel'],
  })
  .refine((g) => !g.obligatorio || g.min_sel >= 1, {
    message: 'Un grupo obligatorio necesita al menos una selección',
    path: ['min_sel'],
  });
export type CrearGrupoOpcionDto = z.infer<typeof crearGrupoOpcionSchema>;

/**
 * Editar un grupo. `codigo` NO está: lo referencian el seed y los productos,
 * y cambiarlo rompería esa relación sin ganar nada.
 *
 * Sin refine cruzado a propósito. Acá los campos son opcionales, así que
 * "activar obligatorio" en un grupo que ya tiene min_sel = 1 llegaría sin
 * min_sel y una regla local lo rechazaría por error. La coherencia entre
 * obligatorio / min_sel / max_sel la valida MenuService sobre el grupo YA
 * combinado con lo que hay guardado.
 */
export const actualizarGrupoOpcionSchema = z.object({
  nombre: z.string().trim().min(2).optional(),
  obligatorio: z.boolean().optional(),
  min_sel: z.number().int().min(0).optional(),
  max_sel: z.number().int().min(1).optional(),
  /** Si viene, reemplaza la lista: las que no estén se desactivan, no se borran. */
  opciones: z.array(crearOpcionSchema).min(1).optional(),
});
export type ActualizarGrupoOpcionDto = z.infer<typeof actualizarGrupoOpcionSchema>;

/** Reordenar por arrastre: lista de ids en el orden nuevo. */
export const reordenarSchema = z.object({
  ids: z.array(zId).min(1),
});
export type ReordenarDto = z.infer<typeof reordenarSchema>;

// ── Interruptores ───────────────────────────────────────────────────────────
// Van con schema propio en vez de leer el body crudo: así un `{"activo":"no"}`
// se rechaza con un mensaje claro en vez de desactivar el producto.

export const cambiarActivoSchema = z.object({ activo: z.boolean() });
export type CambiarActivoDto = z.infer<typeof cambiarActivoSchema>;

/** "Agotado hoy": el producto se sigue viendo pero no se puede pedir. */
export const marcarAgotadoSchema = z.object({ agotado: z.boolean() });
export type MarcarAgotadoDto = z.infer<typeof marcarAgotadoSchema>;
