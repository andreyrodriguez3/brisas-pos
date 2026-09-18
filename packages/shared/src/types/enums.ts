/**
 * Enums del dominio.
 *
 * Se declaran como objetos `as const` + union type en vez de `enum` de TypeScript:
 * así los valores viajan tal cual por JSON, coinciden literalmente con los enums de
 * Prisma y se pueden usar en schemas Zod sin conversión.
 */

export const Rol = {
  MESERA: 'MESERA',
  COCINA: 'COCINA',
  CAJA: 'CAJA',
  ADMIN: 'ADMIN',
} as const;
export type Rol = (typeof Rol)[keyof typeof Rol];

/**
 * Canal de la CUENTA. Es el único campo que clasifica ingresos.
 * Se define al abrir la cuenta y no cambia nunca.
 */
export const CanalCuenta = {
  SALON: 'SALON',
  PARA_LLEVAR: 'PARA_LLEVAR',
} as const;
export type CanalCuenta = (typeof CanalCuenta)[keyof typeof CanalCuenta];

export const EstadoCuenta = {
  ABIERTA: 'ABIERTA',
  EN_COBRO: 'EN_COBRO',
  COBRADA: 'COBRADA',
  ANULADA: 'ANULADA',
} as const;
export type EstadoCuenta = (typeof EstadoCuenta)[keyof typeof EstadoCuenta];

export const EstadoPedido = {
  ENVIADO: 'ENVIADO',
  EN_PREPARACION: 'EN_PREPARACION',
  LISTO: 'LISTO',
  ENTREGADO: 'ENTREGADO',
} as const;
export type EstadoPedido = (typeof EstadoPedido)[keyof typeof EstadoPedido];

export const EstadoLinea = {
  ENVIADO: 'ENVIADO',
  EN_PREPARACION: 'EN_PREPARACION',
  LISTO: 'LISTO',
  ENTREGADO: 'ENTREGADO',
} as const;
export type EstadoLinea = (typeof EstadoLinea)[keyof typeof EstadoLinea];

export const EstadoTurno = {
  ABIERTO: 'ABIERTO',
  CERRADO: 'CERRADO',
} as const;
export type EstadoTurno = (typeof EstadoTurno)[keyof typeof EstadoTurno];

export const TipoDescuento = {
  MONTO: 'MONTO',
  PORCENTAJE: 'PORCENTAJE',
  CORTESIA: 'CORTESIA',
} as const;
export type TipoDescuento = (typeof TipoDescuento)[keyof typeof TipoDescuento];

export const ModoDivision = {
  TOTAL: 'TOTAL',
  PARTES_IGUALES: 'PARTES_IGUALES',
  POR_CONSUMO: 'POR_CONSUMO',
} as const;
export type ModoDivision = (typeof ModoDivision)[keyof typeof ModoDivision];

/** Dato informativo. El sistema NO procesa cobros. */
export const FormaPago = {
  EFECTIVO: 'EFECTIVO',
  TARJETA: 'TARJETA',
  SINPE: 'SINPE',
  MIXTO: 'MIXTO',
} as const;
export type FormaPago = (typeof FormaPago)[keyof typeof FormaPago];

export const ReglaReparto = {
  ATRIBUCION: 'ATRIBUCION',
  HORAS: 'HORAS',
  PARTES_IGUALES: 'PARTES_IGUALES',
} as const;
export type ReglaReparto = (typeof ReglaReparto)[keyof typeof ReglaReparto];

/**
 * Los tres totalizadores del cierre. Independientes entre sí.
 * Ninguna línea de comida cambia de totalizador jamás.
 */
export const Totalizador = {
  SALON: 'SALON',
  PARA_LLEVAR: 'PARA_LLEVAR',
  ENVASES: 'ENVASES',
} as const;
export type Totalizador = (typeof Totalizador)[keyof typeof Totalizador];

/** Acciones que la tabla `auditoria` registra. Append-only. */
export const AccionAuditoria = {
  CUENTA_ABRIR: 'CUENTA_ABRIR',
  CUENTA_EDITAR: 'CUENTA_EDITAR',
  CUENTA_TRASPASAR: 'CUENTA_TRASPASAR',
  CUENTA_ANULAR: 'CUENTA_ANULAR',
  CUENTA_COBRAR: 'CUENTA_COBRAR',
  PEDIDO_ENVIAR: 'PEDIDO_ENVIAR',
  PEDIDO_CAMBIAR_ESTADO: 'PEDIDO_CAMBIAR_ESTADO',
  LINEA_CAMBIAR_ESTADO: 'LINEA_CAMBIAR_ESTADO',
  LINEA_AGREGAR: 'LINEA_AGREGAR',
  LINEA_CAMBIAR_CANTIDAD: 'LINEA_CAMBIAR_CANTIDAD',
  LINEA_CAMBIAR_NOTA: 'LINEA_CAMBIAR_NOTA',
  LINEA_CAMBIAR_OPCIONES: 'LINEA_CAMBIAR_OPCIONES',
  LINEA_MARCAR_PARA_LLEVAR: 'LINEA_MARCAR_PARA_LLEVAR',
  LINEA_ANULAR: 'LINEA_ANULAR',
  DESCUENTO_APLICAR: 'DESCUENTO_APLICAR',
  PAGO_REGISTRAR: 'PAGO_REGISTRAR',
  TURNO_ABRIR: 'TURNO_ABRIR',
  TURNO_CERRAR: 'TURNO_CERRAR',
  TURNO_MESERA_ENTRADA: 'TURNO_MESERA_ENTRADA',
  TURNO_MESERA_SALIDA: 'TURNO_MESERA_SALIDA',
  MENU_EDITAR: 'MENU_EDITAR',
  USUARIO_EDITAR: 'USUARIO_EDITAR',
  CONFIG_EDITAR: 'CONFIG_EDITAR',
} as const;
export type AccionAuditoria = (typeof AccionAuditoria)[keyof typeof AccionAuditoria];

/** Salas del gateway de Socket.IO. */
export const SalaRealtime = {
  COCINA: 'cocina',
  CAJA: 'caja',
  MESERAS: 'meseras',
} as const;
export type SalaRealtime = (typeof SalaRealtime)[keyof typeof SalaRealtime];
