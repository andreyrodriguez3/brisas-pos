import type { EstadoLinea, EstadoPedido, SalaRealtime } from './enums';

/**
 * Contrato de Socket.IO. Backend y frontend usan estos mismos nombres:
 * un evento mal escrito se cae en compilación, no en el servicio de almuerzo.
 */

export const EventosServidor = {
  /** Entró una comanda nueva. Cocina suena la campana. */
  PEDIDO_NUEVO: 'pedido:nuevo',
  PEDIDO_ESTADO: 'pedido:estado',
  /** Un platillo (una línea) cambió de estado. Es lo que avisa a la mesera cuando el suyo está listo. */
  LINEA_ESTADO: 'linea:estado',
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

/**
 * Un platillo cambió de estado. Lleva lo que hace falta para avisarle a la
 * mesera CORRECTA sin que tenga que adivinar de qué mesa era: el nombre del
 * platillo y a qué cuenta pertenece. `mesera_responsable_id` es cómo cada
 * celular decide si el aviso es para ELLA — todas las meseras están en la
 * misma sala de Socket.IO, así que el filtro es responsabilidad del cliente,
 * igual que ya pasa con la edición cruzada de cuentas.
 */
export interface PayloadLineaEstado {
  linea_id: number;
  pedido_id: number;
  cuenta_id: number;
  estado: EstadoLinea;
  /** Quién lo cambió. En cocina no hay login individual: llega como "Cocina". */
  por: string;
  producto_nombre: string;
  variante_etiqueta: string | null;
  nombre_cliente: string;
  referencia: string | null;
  /** null en cuentas PARA_LLEVAR sin mesera asignada: nadie a quien avisarle. */
  mesera_responsable_id: number | null;
}

export interface PayloadCuenta {
  cuenta_id: number;
}
