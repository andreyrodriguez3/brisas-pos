import type { EstadoPedido, SalaRealtime } from './enums';

/**
 * Contrato de Socket.IO. Backend y frontend usan estos mismos nombres:
 * un evento mal escrito se cae en compilación, no en el servicio de almuerzo.
 */

export const EventosServidor = {
  /** Entró una comanda nueva. Cocina suena la campana. */
  PEDIDO_NUEVO: 'pedido:nuevo',
  PEDIDO_ESTADO: 'pedido:estado',
  CUENTA_ABIERTA: 'cuenta:abierta',
  CUENTA_ACTUALIZADA: 'cuenta:actualizada',
  CUENTA_COBRADA: 'cuenta:cobrada',
  TURNO_ABIERTO: 'turno:abierto',
  TURNO_CERRADO: 'turno:cerrado',
  MENU_ACTUALIZADO: 'menu:actualizado',
} as const;
export type EventoServidor = (typeof EventosServidor)[keyof typeof EventosServidor];

export const EventosCliente = {
  /** El cliente pide entrar a una sala (`cocina` | `caja` | `meseras`). */
  UNIRSE: 'sala:unirse',
  SALIR: 'sala:salir',
} as const;
export type EventoCliente = (typeof EventosCliente)[keyof typeof EventosCliente];

export interface PayloadUnirse {
  sala: SalaRealtime;
}

export interface PayloadPedidoNuevo {
  pedido_id: number;
  cuenta_id: number;
  nombre_cliente: string;
  es_agregado: boolean;
  canal: string;
  /** Para pintar la franja de color en la comanda. */
  mesera_nombre: string | null;
  mesera_color: string | null;
}

export interface PayloadPedidoEstado {
  pedido_id: number;
  cuenta_id: number;
  estado: EstadoPedido;
  /** Quién lo cambió. En cocina no hay login individual: llega como "Cocina". */
  por: string;
}

export interface PayloadCuenta {
  cuenta_id: number;
}
