import type { LineaNuevaDto } from '@brisas/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PedidoPendiente {
  /** La genera el celular ANTES de intentar mandar. Es la clave de todo esto. */
  idempotencia_key: string;
  cuenta_id: number;
  /** Para poder decir "pendiente: Don Carlos" sin tener que consultar nada. */
  cuenta_nombre: string;
  lineas: LineaNuevaDto[];
  encolado_en: string;
  intentos: number;
  ultimo_error?: string;
}

interface EstadoCola {
  pendientes: PedidoPendiente[];
  encolar: (pedido: Omit<PedidoPendiente, 'intentos' | 'encolado_en'>) => void;
  quitar: (key: string) => void;
  marcarIntentoFallido: (key: string, error: string) => void;
}

/**
 * Cola offline de pedidos.
 *
 * El WiFi del restaurante tiene puntos débiles y la mesera no puede perder un
 * pedido por eso. El pedido se guarda en el celular ANTES de intentar mandarlo,
 * con una clave de idempotencia que el servidor usa para reconocer reenvíos: si
 * el teléfono manda tres veces porque nunca vio la respuesta, cocina recibe UNA
 * comanda.
 *
 * Vive en localStorage, así que sobrevive a que se cierre el navegador o se
 * reinicie el celular a mitad de servicio.
 *
 * Lo que NO se encola es abrir una cuenta: eso necesita un id del servidor y no
 * hay forma honesta de inventarlo en el celular. Sin señal, la mesera no puede
 * abrir una cuenta nueva — pero sí puede seguir cargando pedidos a las que ya
 * están abiertas, que es el caso que importa en plena hora pico.
 */
export const useColaOffline = create<EstadoCola>()(
  persist(
    (set) => ({
      pendientes: [],

      encolar: (pedido) =>
        set((s) => ({
          pendientes: [...s.pendientes, { ...pedido, intentos: 0, encolado_en: new Date().toISOString() }],
        })),

      quitar: (key) =>
        set((s) => ({ pendientes: s.pendientes.filter((p) => p.idempotencia_key !== key) })),

      marcarIntentoFallido: (key, error) =>
        set((s) => ({
          pendientes: s.pendientes.map((p) =>
            p.idempotencia_key === key
              ? { ...p, intentos: p.intentos + 1, ultimo_error: error }
              : p,
          ),
        })),
    }),
    { name: 'brisas-cola-pedidos' },
  ),
);

/** Cuántos pedidos hay esperando señal. Lo muestra el encabezado. */
export function usePendientes(): PedidoPendiente[] {
  return useColaOffline((s) => s.pendientes);
}
