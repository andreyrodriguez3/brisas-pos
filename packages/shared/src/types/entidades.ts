import type {
  AccionAuditoria,
  CanalCuenta,
  EstadoCuenta,
  EstadoLinea,
  EstadoPedido,
  EstadoTurno,
  FormaPago,
  ModoDivision,
  ReglaReparto,
  Rol,
  TipoDescuento,
} from './enums';

/**
 * Entidades del dominio tal como viajan por la API (JSON).
 *
 * Convenciones:
 * - Los nombres de campo son los mismos que en `schema.prisma` y en el plan de
 *   trabajo: español, snake_case. El código se lee junto al negocio.
 * - Las fechas viajan como string ISO 8601 en UTC. Las pone SIEMPRE el servidor.
 * - Todo monto es un ENTERO de colones. Nunca float, nunca decimales.
 */

/** Fecha/hora ISO 8601 generada por el servidor. */
export type FechaISO = string;

/** Entero de colones. Alias documental: TypeScript no lo puede forzar solo. */
export type Colones = number;

export interface Usuario {
  id: number;
  nombre: string;
  rol: Rol;
  color_hex: string;
  activo: boolean;
  creado_en: FechaISO;
  // pin_hash nunca sale del backend.
}

export interface Turno {
  id: number;
  fecha: FechaISO;
  abierto_en: FechaISO;
  abierto_por_id: number;
  cerrado_en: FechaISO | null;
  cerrado_por_id: number | null;
  estado: EstadoTurno;
}

export interface TurnoMesera {
  id: number;
  turno_id: number;
  usuario_id: number;
  hora_entrada: FechaISO;
  hora_salida: FechaISO | null;
}

// ── Menú ────────────────────────────────────────────────────────────────────

export interface Categoria {
  id: number;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface Producto {
  id: number;
  categoria_id: number;
  nombre_es: string;
  nombre_en: string | null;
  descripcion: string | null;
  activo: boolean;
  /** Se agotó hoy. Se muestra pero no se puede pedir. Se limpia al abrir turno. */
  agotado: boolean;
  orden: number;
  /** El envase plástico. Sus líneas van siempre al totalizador ENVASES. */
  es_envase: boolean;
}

export interface Variante {
  id: number;
  producto_id: number;
  etiqueta: string;
  /** null = sin precio cargado. El producto no se puede vender. */
  precio_colones: Colones | null;
  orden: number;
  activo: boolean;
}

export interface GrupoOpcion {
  id: number;
  codigo: string;
  nombre: string;
  obligatorio: boolean;
  min_sel: number;
  max_sel: number;
  opciones?: Opcion[];
}

export interface Opcion {
  id: number;
  grupo_opcion_id: number;
  nombre: string;
  precio_extra: Colones;
  activo: boolean;
}

/** Producto con todo lo necesario para pintarlo y pedirlo. */
export interface ProductoCompleto extends Producto {
  variantes: Variante[];
  grupos_opcion: GrupoOpcion[];
}

export interface CategoriaConProductos extends Categoria {
  productos: ProductoCompleto[];
}

// ── Vistas del panel de admin ───────────────────────────────────────────────
// Incluyen lo desactivado y lo que no tiene precio, que es justamente lo que la
// dueña necesita ver para arreglarlo. El catálogo de mesera y caja no lo trae.

export interface ProductoAdmin extends Producto {
  variantes: Variante[];
  grupos_opcion_ids: number[];
  /** Se puede pedir hoy: activo, no agotado y con al menos un precio cargado. */
  vendible: boolean;
}

export interface CategoriaAdmin extends Categoria {
  productos: ProductoAdmin[];
}

export interface GrupoOpcionAdmin extends GrupoOpcion {
  opciones: Opcion[];
  /** Cuántos productos lo usan. Avisa antes de tocar un grupo compartido. */
  _count: { productos: number };
}

// ── Cuentas y pedidos ───────────────────────────────────────────────────────

export interface Cuenta {
  id: number;
  turno_id: number;
  /** LO QUE CLASIFICA INGRESOS. Se fija al abrir y no cambia. */
  canal: CanalCuenta;
  nombre_cliente: string;
  referencia: string | null;
  /** Obligatorio en PARA_LLEVAR. */
  telefono: string | null;
  /** Obligatorio en PARA_LLEVAR. Ordena la cola de cocina. */
  hora_retiro: FechaISO | null;
  /** null en PARA_LLEVAR: normalmente las abre caja, que contesta el teléfono. */
  mesera_responsable_id: number | null;
  estado: EstadoCuenta;
  abierta_en: FechaISO;
  cerrada_en: FechaISO | null;
  abierta_por_id: number;
}

export interface Comensal {
  id: number;
  cuenta_id: number;
  etiqueta: string;
  orden: number;
}

export interface Pedido {
  id: number;
  cuenta_id: number;
  /** Número de comanda del día. Lo asigna el servidor. */
  consecutivo_dia: number;
  creado_por_id: number;
  creado_en: FechaISO;
  estado: EstadoPedido;
  /** true si la cuenta ya tenía pedidos. Cocina lo pinta con la banda AGREGADO. */
  es_agregado: boolean;
}

export interface PedidoLinea {
  id: number;
  pedido_id: number;
  producto_id: number;
  variante_id: number;
  cantidad: number;
  /** Precio CONGELADO al crear la línea. Jamás se recalcula desde el menú. */
  precio_unit_snapshot: Colones;
  nota: string | null;
  /**
   * SOLO dispara el cargo del envase. NO clasifica ingresos.
   * La clasificación contable la hace `cuenta.canal`, siempre.
   */
  para_llevar: boolean;
  anulada: boolean;
  estado_linea: EstadoLinea;
}

export interface LineaOpcion {
  id: number;
  linea_id: number;
  opcion_id: number;
  nombre_snapshot: string;
  precio_extra_snapshot: Colones;
}

export interface LineaComensal {
  id: number;
  linea_id: number;
  comensal_id: number;
  /** Parte de la línea que le toca a este comensal. Las fracciones suman 1. */
  fraccion: number;
}

export interface LineaCompleta extends PedidoLinea {
  opciones: LineaOpcion[];
  producto_nombre: string;
  variante_etiqueta: string;
  es_envase: boolean;
  /** (precio congelado + extras congelados) × cantidad. Ya calculado. */
  total: Colones;
}

export interface PedidoCompleto extends Pedido {
  lineas: LineaCompleta[];
  total: Colones;
  /** Quién lo mandó a cocina. Puede no ser la mesera responsable de la cuenta. */
  creado_por_nombre: string;
}

/**
 * Cuenta como se ve en la lista del celular de la mesera y en el tablero de caja.
 * Trae lo justo para pintar la tarjeta sin abrirla.
 */
export interface CuentaResumen extends Cuenta {
  /** Van juntos SIEMPRE: el color nunca es la única señal. */
  mesera_nombre: string | null;
  mesera_color: string | null;
  total: Colones;
  n_pedidos: number;
  /** El estado MENOS avanzado de sus comandas: es lo que la mesera espera. */
  estado_cocina: EstadoPedido | null;
  /** Alguien distinto a la responsable la tocó. La tarjeta lo muestra. */
  editada_por_terceros: boolean;
}

export interface CuentaCompleta extends Cuenta {
  /** Van juntos SIEMPRE: el color nunca es la única señal. */
  mesera_nombre: string | null;
  mesera_color: string | null;
  pedidos: PedidoCompleto[];
  comensales: Comensal[];
  descuentos: Descuento[];
  pagos: Pago[];
  total: Colones;
  /** Total menos lo ya pagado. Permite pagos parciales. */
  saldo: Colones;
  /** true si alguien distinto a la responsable tocó la cuenta. */
  editada_por_terceros: boolean;
}

// ── Cocina ──────────────────────────────────────────────────────────────────
// Lo que ve la tablet. Sin un solo precio: a la cocina no le sirven y ocupan el
// lugar de lo que sí importa, que es el nombre del cliente y las notas.

/** Una línea como la ve cocina. */
export interface LineaComanda {
  id: number;
  cantidad: number;
  producto_nombre: string;
  /** null cuando el producto tiene una sola presentación: no aporta nada. */
  variante_etiqueta: string | null;
  /** Ya congeladas: "con papas", "en leche". */
  opciones: string[];
  /** "SIN CEBOLLA". Va en mayúsculas y destacada: es lo que más se pasa por alto. */
  nota: string | null;
}

export interface ComandaCocina {
  pedido_id: number;
  cuenta_id: number;
  /** El número de comanda del día. */
  consecutivo_dia: number;
  estado: EstadoPedido;
  /** true = se suma a una cuenta que ya tenía pedidos. Banda naranja AGREGADO. */
  es_agregado: boolean;
  nombre_cliente: string;
  referencia: string | null;
  canal: CanalCuenta;
  /** Solo en PARA_LLEVAR. Es lo que ordena la cola de esas comandas. */
  hora_retiro: FechaISO | null;
  /** Van juntos SIEMPRE: el color nunca es la única señal. */
  mesera_nombre: string | null;
  mesera_color: string | null;
  creado_en: FechaISO;
  lineas: LineaComanda[];
}

export interface ColaCocina {
  comandas: ComandaCocina[];
  /** Del `configuracion`, no hardcodeados en la pantalla. */
  umbrales: { alerta: number; urgente: number };
  /**
   * INVARIANTE 6: el temporizador se mide contra el reloj del SERVIDOR.
   * La tablet puede tener la hora mal y no debe poder pintar de rojo una
   * comanda que acaba de entrar.
   */
  hora_servidor: FechaISO;
}

// ── La pantalla de cobro ────────────────────────────────────────────────────

/** Una parte a cobrar: la cuenta entera, una de las partes iguales, o un comensal. */
export interface ParteCobro {
  /** 1, 2, 3… Es lo que se guarda en `pago.parte_num`. */
  numero: number;
  /** "Total", "Parte 2 de 3", "Ana". */
  etiqueta: string;
  monto: Colones;
  pagado: Colones;
  saldo: Colones;
}

export interface ComensalConTotal extends Comensal {
  /** Lo que le toca pagar, ya con su parte de las líneas compartidas. */
  total: Colones;
  /** Las líneas que tiene asignadas, con cuántas partes de cada una. */
  lineas: Array<{ linea_id: number; partes: number; monto: Colones }>;
}

/** Una línea que todavía no se le asignó a nadie. Bloquea el cierre del cobro. */
export interface LineaPendienteAsignar {
  linea_id: number;
  descripcion: string;
  total: Colones;
}

/**
 * Todo lo que la pantalla de cobro necesita, calculado por el servidor.
 *
 * Los montos salen de `shared/money`: el saldo que ve la caja es exactamente el
 * que el servidor usa para decidir si la cuenta quedó saldada.
 */
export interface EstadoCobro {
  cuenta_id: number;
  estado: EstadoCuenta;
  modo: ModoDivision;
  n_partes: number | null;
  subtotal: Colones;
  descuento: Colones;
  total: Colones;
  pagado: Colones;
  saldo: Colones;
  /** Cuánto descontó cada descuento, en orden. La pantalla lo muestra desglosado. */
  detalle_descuentos: Colones[];
  partes: ParteCobro[];
  comensales: ComensalConTotal[];
  sin_asignar: LineaPendienteAsignar[];
  /** "Hay 2 comandas que cocina no ha entregado". Avisan, no bloquean. */
  advertencias: string[];
  /** false mientras queden líneas sin asignar en POR_CONSUMO. */
  se_puede_cobrar: boolean;
}

/** Un registro de la bitácora, con quién lo hizo. */
export interface AuditoriaConUsuario extends Auditoria {
  usuario_nombre: string;
  usuario_color: string;
}

// ── Turno y cierre del día ──────────────────────────────────────────────────

/** Una mesera en el turno, con sus horas ya calculadas por el servidor. */
export interface MeseraEnTurno {
  id: number;
  usuario_id: number;
  nombre: string;
  color_hex: string;
  hora_entrada: FechaISO;
  hora_salida: FechaISO | null;
  /** Hasta la salida, o hasta ahora si todavía está trabajando. */
  horas_trabajadas: number;
  /** Ventas de salón de las cuentas que ella abrió, hasta este momento. */
  ventas_atribuidas: Colones;
}

export interface EstadoTurnoActual {
  turno: Turno | null;
  meseras: MeseraEnTurno[];
  /** Cuentas que todavía no se cobraron ni se anularon. Impiden cerrar. */
  cuentas_sin_resolver: Array<{ id: number; nombre_cliente: string; total: Colones }>;
  /** Lo vendido hasta ahora, en las tres bolsas. */
  totalizadores: { salon: Colones; para_llevar: Colones; envases: Colones };
  puede_cerrar: boolean;
}

/** Cuánto entró por cada forma de pago. Para cuadrar la caja física. */
export interface DesglosePorFormaPago {
  forma_pago: FormaPago;
  monto: Colones;
  n_pagos: number;
}

export interface MeseraDelCierre {
  usuario_id: number;
  nombre: string;
  color_hex: string;
  hora_entrada: FechaISO;
  hora_salida: FechaISO | null;
  /** Dato crudo: permite recalcular si la regla de reparto cambia después. */
  horas_trabajadas: number;
  /** Dato crudo: total de salón de las cuentas que ella abrió. */
  ventas_atribuidas: Colones;
  monto_atribucion: Colones;
  monto_horas: Colones;
  monto_partes_iguales: Colones;
  /** El que manda hoy, según `configuracion.REGLA_REPARTO`. */
  monto_aplicado: Colones;
}

/**
 * El cierre del día, completo y reimprimible.
 *
 * Se guarda tal cual en `cierre_dia.desglose_json`: el cierre es un registro
 * histórico inmutable, y tiene que poder volver a mostrarse mañana exactamente
 * igual aunque el menú, los precios o la regla de reparto hayan cambiado.
 */
export interface CierreCompleto {
  cierre_id: number;
  turno_id: number;
  fecha: string;
  abierto_en: FechaISO;
  cerrado_en: FechaISO;
  generado_en: FechaISO;

  /** Las tres bolsas, siempre por separado. */
  total_salon: Colones;
  total_para_llevar: Colones;
  total_envases: Colones;
  total_descuentos: Colones;
  /** Salón + para llevar + envases − descuentos. Lo que efectivamente entró. */
  total_cobrado: Colones;

  regla_aplicada: ReglaReparto;
  /** Lo que se reparte en las reglas por horas y partes iguales: el salón. */
  base_reparto: Colones;
  meseras: MeseraDelCierre[];

  formas_pago: DesglosePorFormaPago[];
  cuentas_anuladas: Array<{
    id: number;
    nombre_cliente: string;
    motivo: string | null;
    anulada_por: string;
  }>;
  n_cuentas: number;
  n_pedidos: number;
}

// ── Reportes de admin ───────────────────────────────────────────────────────

export interface VentasPorDia {
  dia: string;
  salon: Colones;
  para_llevar: Colones;
  envases: Colones;
  n_cuentas: number;
}

export interface VentasPorMesera {
  usuario_id: number;
  nombre: string;
  color_hex: string;
  ventas: Colones;
  n_cuentas: number;
}

export interface VentasPorPlatillo {
  producto_id: number;
  nombre: string;
  categoria: string;
  unidades: number;
  monto: Colones;
}

export interface ReporteVentas {
  desde: string;
  hasta: string;
  totalizadores: { salon: Colones; para_llevar: Colones; envases: Colones };
  total_descuentos: Colones;
  por_dia: VentasPorDia[];
  por_mesera: VentasPorMesera[];
  por_platillo: VentasPorPlatillo[];
  formas_pago: DesglosePorFormaPago[];
}

// ── Auditoría, cobro y cierre ───────────────────────────────────────────────

export interface Auditoria {
  id: number;
  cuenta_id: number | null;
  pedido_id: number | null;
  linea_id: number | null;
  usuario_id: number;
  accion: AccionAuditoria;
  antes_json: string | null;
  despues_json: string | null;
  motivo: string | null;
  creado_en: FechaISO;
}

export interface Descuento {
  id: number;
  cuenta_id: number;
  tipo: TipoDescuento;
  /** Colones si tipo=MONTO, porcentaje 0–100 si tipo=PORCENTAJE, total si CORTESIA. */
  valor: number;
  /** Obligatorio, siempre. */
  motivo: string;
  autorizado_por_id: number;
  creado_en: FechaISO;
}

export interface Division {
  id: number;
  cuenta_id: number;
  modo: ModoDivision;
  n_partes: number | null;
}

export interface Pago {
  id: number;
  cuenta_id: number;
  division_id: number | null;
  parte_num: number | null;
  monto: Colones;
  /** Informativo. El sistema no procesa cobros. */
  forma_pago: FormaPago;
  registrado_por_id: number;
  creado_en: FechaISO;
}

export interface CierreDia {
  id: number;
  turno_id: number;
  total_salon: Colones;
  total_para_llevar: Colones;
  total_envases: Colones;
  total_descuentos: Colones;
  regla_aplicada: ReglaReparto;
  n_meseras: number;
  /** Desglose completo del cálculo, no solo el número final. */
  desglose_json: string;
  generado_en: FechaISO;
}

export interface CierreMesera {
  id: number;
  cierre_id: number;
  usuario_id: number;
  /** Dato crudo: permite recalcular si la regla de reparto cambia después. */
  horas_trabajadas: number;
  /** Dato crudo: total de las cuentas de salón que ella abrió. */
  ventas_atribuidas: Colones;
  monto_atribucion: Colones;
  monto_horas: Colones;
  monto_partes_iguales: Colones;
}

export interface Configuracion {
  clave: string;
  valor: string;
  descripcion: string | null;
}
