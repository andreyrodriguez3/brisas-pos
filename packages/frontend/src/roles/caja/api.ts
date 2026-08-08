/** Claves de React Query de caja, en un solo lugar. */
export const CLAVES_CAJA = {
  cuentas: ['cuentas'] as const,
  cuenta: (id: number) => ['cuentas', id] as const,
  cobro: (id: number) => ['cuentas', id, 'cobro'] as const,
  bitacora: (id: number) => ['auditoria', 'cuenta', id] as const,
  menu: ['menu'] as const,
  turno: ['turnos', 'actual'] as const,
  cierres: ['cierres'] as const,
};

/** Cómo se lee cada acción de la bitácora en la ficha de la cuenta. */
export const TEXTO_ACCION: Record<string, string> = {
  CUENTA_ABRIR: 'Abrió la cuenta',
  CUENTA_EDITAR: 'Editó la cuenta',
  CUENTA_TRASPASAR: 'Traspasó la cuenta',
  CUENTA_ANULAR: 'Anuló la cuenta',
  CUENTA_COBRAR: 'Preparó el cobro',
  PEDIDO_ENVIAR: 'Mandó un pedido a cocina',
  PEDIDO_CAMBIAR_ESTADO: 'Cambió el estado en cocina',
  LINEA_AGREGAR: 'Agregó una línea',
  LINEA_CAMBIAR_CANTIDAD: 'Cambió una cantidad',
  LINEA_CAMBIAR_NOTA: 'Cambió una nota',
  LINEA_CAMBIAR_OPCIONES: 'Cambió las opciones',
  LINEA_MARCAR_PARA_LLEVAR: 'Marcó que se lo lleva (envase)',
  LINEA_ANULAR: 'Anuló una línea',
  DESCUENTO_APLICAR: 'Aplicó un descuento',
  PAGO_REGISTRAR: 'Registró un pago',
  TURNO_ABRIR: 'Abrió el turno',
  TURNO_CERRAR: 'Cerró el turno',
};

export const FORMAS_PAGO = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
  { valor: 'SINPE', etiqueta: 'SINPE' },
  { valor: 'MIXTO', etiqueta: 'Mixto' },
] as const;
