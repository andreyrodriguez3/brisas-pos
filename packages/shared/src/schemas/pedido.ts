import { z } from 'zod';
import { EstadoLinea, EstadoPedido } from '../types/enums';
import { zCantidad, zId, zNota } from './comunes';

export const lineaNuevaSchema = z.object({
  producto_id: zId,
  variante_id: zId,
  cantidad: zCantidad,
  opciones_ids: z.array(zId).default([]),
  /** MAYÚSCULAS en cocina: "SIN CEBOLLA". Es el dato que más se pasa por alto. */
  nota: zNota,
  /**
   * ⚠️ SOLO dispara el cargo del envase de ₡200.
   * NO reclasifica la venta: eso lo hace `cuenta.canal`, siempre.
   */
  para_llevar: z.boolean().default(false),
});
export type LineaNuevaDto = z.infer<typeof lineaNuevaSchema>;

/**
 * Enviar un pedido a cocina.
 *
 * Cada envío crea una comanda NUEVA e independiente. Si la cuenta ya tenía
 * pedidos, el servidor marca `es_agregado = true` y cocina lo pinta con la
 * banda naranja AGREGADO. El cliente no manda esa bandera: la deduce el servidor.
 *
 * Los precios se congelan en este momento (`precio_unit_snapshot`).
 */
export const enviarPedidoSchema = z.object({
  cuenta_id: zId,
  lineas: z.array(lineaNuevaSchema).min(1, 'El pedido no puede ir vacío'),
  /** Id local de la cola offline: permite descartar envíos duplicados. */
  idempotencia_key: z.string().uuid().optional(),
});
export type EnviarPedidoDto = z.infer<typeof enviarPedidoSchema>;

export const cambiarEstadoPedidoSchema = z.object({
  estado: z.nativeEnum(EstadoPedido),
});
export type CambiarEstadoPedidoDto = z.infer<typeof cambiarEstadoPedidoSchema>;

/** Cocina avanza (o retrocede, para el DESHACER) un platillo, no la comanda entera. */
export const cambiarEstadoLineaSchema = z.object({
  estado: z.nativeEnum(EstadoLinea),
});
export type CambiarEstadoLineaDto = z.infer<typeof cambiarEstadoLineaSchema>;

export const editarLineaSchema = z.object({
  cantidad: zCantidad.optional(),
  nota: zNota,
  opciones_ids: z.array(zId).optional(),
  para_llevar: z.boolean().optional(),
});
export type EditarLineaDto = z.infer<typeof editarLineaSchema>;
