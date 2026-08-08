import {
  calcularTotalLinea,
  sumarLineas,
  type GrupoOpcion,
  type LineaNuevaDto,
  type Opcion,
  type ProductoCompleto,
  type Variante,
} from '@brisas/shared';
import { create } from 'zustand';

/** Un ítem del carrito, con lo necesario para pintarlo sin volver a buscar nada. */
export interface ItemCarrito {
  /** Id local, solo para React. El servidor no lo ve. */
  clave: string;
  producto: ProductoCompleto;
  variante: Variante;
  cantidad: number;
  opciones: Array<{ grupo: GrupoOpcion; opcion: Opcion }>;
  nota: string;
  /**
   * ⚠️ SOLO dispara el cargo del envase de ₡200.
   * NO cambia a qué totalizador va la venta: eso lo decide `cuenta.canal`.
   */
  para_llevar: boolean;
}

interface EstadoCarrito {
  /** El carrito es de UNA cuenta a la vez. */
  cuentaId: number | null;
  items: ItemCarrito[];
  abrirPara: (cuentaId: number) => void;
  agregar: (item: Omit<ItemCarrito, 'clave'>) => void;
  cambiarCantidad: (clave: string, cantidad: number) => void;
  quitar: (clave: string) => void;
  vaciar: () => void;
}

export const useCarrito = create<EstadoCarrito>((set) => ({
  cuentaId: null,
  items: [],

  /** Cambiar de cuenta vacía el carrito: mezclarlos sería mandar comida a la mesa equivocada. */
  abrirPara: (cuentaId) =>
    set((s) => (s.cuentaId === cuentaId ? s : { cuentaId, items: [] })),

  agregar: (item) =>
    set((s) => ({
      items: [...s.items, { ...item, clave: crypto.randomUUID() }],
    })),

  cambiarCantidad: (clave, cantidad) =>
    set((s) => ({
      items: s.items.flatMap((i) =>
        i.clave !== clave ? [i] : cantidad <= 0 ? [] : [{ ...i, cantidad }],
      ),
    })),

  quitar: (clave) => set((s) => ({ items: s.items.filter((i) => i.clave !== clave) })),

  vaciar: () => set({ items: [] }),
}));

/**
 * Lo que un ítem le suma al subtotal.
 *
 * Usa `calcularTotalLinea` de shared — la MISMA función que corre en el servidor
 * al congelar la línea. Reescribir la multiplicación acá sería crear una segunda
 * verdad sobre el dinero, y la que se ve en el celular tiene que ser exactamente
 * la que se va a cobrar.
 */
export function totalItem(item: ItemCarrito): number {
  return calcularTotalLinea({
    cantidad: item.cantidad,
    precio_unit_snapshot: item.variante.precio_colones ?? 0,
    opciones: item.opciones.map((o) => ({ precio_extra_snapshot: o.opcion.precio_extra })),
  });
}

export function subtotalCarrito(items: ItemCarrito[]): number {
  return sumarLineas(
    items.map((i) => ({
      cantidad: i.cantidad,
      precio_unit_snapshot: i.variante.precio_colones ?? 0,
      opciones: i.opciones.map((o) => ({ precio_extra_snapshot: o.opcion.precio_extra })),
    })),
  );
}

/** Traduce el carrito a lo que espera el endpoint. */
export function aLineasDto(items: ItemCarrito[]): LineaNuevaDto[] {
  return items.map((i) => ({
    producto_id: i.producto.id,
    variante_id: i.variante.id,
    cantidad: i.cantidad,
    opciones_ids: i.opciones.map((o) => o.opcion.id),
    nota: i.nota.trim() || undefined,
    para_llevar: i.para_llevar,
  }));
}
