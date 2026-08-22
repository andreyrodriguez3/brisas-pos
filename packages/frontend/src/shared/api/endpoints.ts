import type {
  AbrirCuentaDto,
  AbrirTurnoDto,
  AgregarMeseraDto,
  CerrarTurnoDto,
  CierreCompleto,
  EstadoTurnoActual,
  MarcarSalidaDto,
  ReglaReparto,
  ReporteVentas,
  ActualizarGrupoOpcionDto,
  ActualizarProductoDto,
  ActualizarUsuarioDto,
  AplicarDescuentoDto,
  AsignarLineasDto,
  AuditoriaConUsuario,
  CategoriaAdmin,
  CategoriaConProductos,
  ColaCocina,
  ColorPaletaEstado,
  Configuracion,
  CrearCategoriaDto,
  CrearGrupoOpcionDto,
  CrearProductoDto,
  CrearUsuarioDto,
  CuentaCompleta,
  CuentaResumen,
  EditarCuentaDto,
  EditarLineaDto,
  EnviarPedidoDto,
  EstadoCobro,
  EstadoLinea,
  EstadoPedido,
  FijarDivisionDto,
  GrupoOpcionAdmin,
  GuardarComensalesDto,
  RegistrarPagoDto,
  LoginDto,
  PayloadJwt,
  Producto,
  ProductoAdmin,
  Sesion,
  TraspasarCuentaDto,
  Usuario,
} from '@brisas/shared';
import { api } from './cliente';

/** Fila de la lista de cierres. El detalle completo llega con `cierres.ver`. */
export interface ResumenCierre {
  id: number;
  turno_id: number;
  fecha: string;
  total_salon: number;
  total_para_llevar: number;
  total_envases: number;
  total_descuentos: number;
  regla_aplicada: ReglaReparto;
  n_meseras: number;
  generado_en: string;
}

/** Rutas de la API en un solo lugar: un typo se cae en compilación. */
export const endpoints = {
  auth: {
    usuarios: () =>
      api.get<Array<Pick<Usuario, 'id' | 'nombre' | 'rol' | 'color_hex'>>>('/auth/usuarios'),
    login: (dto: LoginDto) => api.post<Sesion>('/auth/login', dto),
    /** La tablet de cocina entra sin PIN. */
    cocina: () => api.post<Sesion>('/auth/cocina'),
    yo: () => api.get<PayloadJwt>('/auth/yo'),
  },

  menu: {
    /** Solo lo vendible. Lo usan mesera y caja para armar pedidos. */
    catalogo: () => api.get<CategoriaConProductos[]>('/menu'),
    /** Todo, incluido lo desactivado y lo que no tiene precio. */
    admin: () => api.get<CategoriaAdmin[]>('/menu/admin'),
    envase: () => api.get<Producto>('/menu/envase'),

    crearCategoria: (dto: CrearCategoriaDto) => api.post<CategoriaAdmin>('/menu/categorias', dto),
    actualizarCategoria: (id: number, dto: Partial<CrearCategoriaDto> & { activo?: boolean }) =>
      api.put<CategoriaAdmin>(`/menu/categorias/${id}`, dto),

    crearProducto: (dto: CrearProductoDto) => api.post<ProductoAdmin>('/menu/productos', dto),
    actualizarProducto: (id: number, dto: ActualizarProductoDto) =>
      api.put<ProductoAdmin>(`/menu/productos/${id}`, dto),

    /** Nunca se borra un producto: se desactiva. */
    cambiarActivo: (id: number, activo: boolean) =>
      api.patch<Producto>(`/menu/productos/${id}/activo`, { activo }),
    marcarAgotado: (id: number, agotado: boolean) =>
      api.patch<Producto>(`/menu/productos/${id}/agotado`, { agotado }),
    limpiarAgotados: () =>
      api.patch<{ ok: boolean; limpiados: number }>('/menu/productos/limpiar-agotados'),

    reordenarProductos: (ids: number[]) =>
      api.patch<{ ok: boolean }>('/menu/productos/reordenar', { ids }),
    reordenarCategorias: (ids: number[]) =>
      api.patch<{ ok: boolean }>('/menu/categorias/reordenar', { ids }),

    gruposOpcion: () => api.get<GrupoOpcionAdmin[]>('/menu/grupos-opcion'),
    crearGrupoOpcion: (dto: CrearGrupoOpcionDto) =>
      api.post<GrupoOpcionAdmin>('/menu/grupos-opcion', dto),
    actualizarGrupoOpcion: (id: number, dto: ActualizarGrupoOpcionDto) =>
      api.put<GrupoOpcionAdmin>(`/menu/grupos-opcion/${id}`, dto),
  },

  cuentas: {
    listar: () => api.get<CuentaResumen[]>('/cuentas'),
    detalle: (id: number) => api.get<CuentaCompleta>(`/cuentas/${id}`),
    abrir: (dto: AbrirCuentaDto) => api.post<CuentaCompleta>('/cuentas', dto),
    editar: (id: number, dto: EditarCuentaDto) => api.put<CuentaCompleta>(`/cuentas/${id}`, dto),
    /** Lo ÚNICO que cambia la mesera responsable. */
    traspasar: (id: number, dto: TraspasarCuentaDto) =>
      api.post<CuentaCompleta>(`/cuentas/${id}/traspasar`, dto),
    anular: (id: number, motivo: string) =>
      api.post<CuentaCompleta>(`/cuentas/${id}/anular`, { motivo }),
  },

  pedidos: {
    enviar: (dto: EnviarPedidoDto) => api.post<CuentaCompleta>('/pedidos', dto),
    /** La cola de cocina, con los umbrales y la hora del servidor. */
    cocina: () => api.get<ColaCocina>('/pedidos/cocina'),
    editarLinea: (lineaId: number, dto: EditarLineaDto) =>
      api.patch<CuentaCompleta>(`/pedidos/lineas/${lineaId}`, dto),
    anularLinea: (lineaId: number, motivo: string) =>
      api.patch<CuentaCompleta>(`/pedidos/lineas/${lineaId}/anular`, { motivo }),
    /** La comanda entera de una vez — la mesera recogiendo todo el pedido junto. */
    cambiarEstado: (pedidoId: number, estado: EstadoPedido) =>
      api.patch<unknown>(`/pedidos/${pedidoId}/estado`, { estado }),
    /** Un solo platillo — lo que toca la tablet de cocina. */
    cambiarEstadoLinea: (lineaId: number, estado: EstadoLinea) =>
      api.patch<unknown>(`/pedidos/lineas/${lineaId}/estado`, { estado }),
  },

  /**
   * Cobro. Todo pide rol CAJA en el backend — esconder el botón no es seguridad.
   * Cada llamada devuelve el estado de cobro completo y recalculado.
   */
  cobro: {
    estado: (cuentaId: number) => api.get<EstadoCobro>(`/cuentas/${cuentaId}/cobro`),
    fijarDivision: (cuentaId: number, dto: FijarDivisionDto) =>
      api.put<EstadoCobro>(`/cuentas/${cuentaId}/cobro/division`, dto),
    guardarComensales: (cuentaId: number, dto: GuardarComensalesDto) =>
      api.put<EstadoCobro>(`/cuentas/${cuentaId}/cobro/comensales`, dto),
    asignarLineas: (cuentaId: number, dto: AsignarLineasDto) =>
      api.put<EstadoCobro>(`/cuentas/${cuentaId}/cobro/asignaciones`, dto),
    aplicarDescuento: (cuentaId: number, dto: AplicarDescuentoDto) =>
      api.post<EstadoCobro>(`/cuentas/${cuentaId}/cobro/descuentos`, dto),
    registrarPago: (cuentaId: number, dto: RegistrarPagoDto) =>
      api.post<EstadoCobro>(`/cuentas/${cuentaId}/cobro/pagos`, dto),
    /** Para la cortesía: total en cero, no hay pago que registrar. */
    cerrar: (cuentaId: number) => api.post<EstadoCobro>(`/cuentas/${cuentaId}/cobro/cerrar`),
  },

  /** Solo lectura. La bitácora es append-only: no hay ni habrá update ni delete. */
  auditoria: {
    deCuenta: (cuentaId: number) => api.get<AuditoriaConUsuario[]>(`/auditoria/cuenta/${cuentaId}`),
    buscar: (filtro: Record<string, string | number | undefined>) => {
      const query = new URLSearchParams();
      for (const [clave, valor] of Object.entries(filtro)) {
        if (valor !== undefined && valor !== '') query.set(clave, String(valor));
      }
      return api.get<AuditoriaConUsuario[]>(`/auditoria?${query.toString()}`);
    },
  },

  /** Turno y cierre del día. Rol CAJA. */
  turnos: {
    actual: () => api.get<EstadoTurnoActual>('/turnos/actual'),
    abrir: (dto: AbrirTurnoDto) => api.post<EstadoTurnoActual>('/turnos/abrir', dto),
    agregarMesera: (turnoId: number, dto: AgregarMeseraDto) =>
      api.post<unknown>(`/turnos/${turnoId}/meseras`, dto),
    marcarSalida: (turnoMeseraId: number, dto: MarcarSalidaDto = {}) =>
      api.put<unknown>(`/turnos/meseras/${turnoMeseraId}/salida`, dto),
    /** Los números antes de cerrar. No guarda nada. */
    previa: (turnoId: number) => api.get<CierreCompleto>(`/turnos/${turnoId}/previa`),
    cerrar: (turnoId: number, dto: CerrarTurnoDto) =>
      api.post<CierreCompleto>(`/turnos/${turnoId}/cerrar`, dto),
  },

  /** Cierres ya hechos. Inmutables y reimprimibles. */
  cierres: {
    listar: () => api.get<ResumenCierre[]>('/cierres'),
    ver: (id: number) => api.get<CierreCompleto>(`/cierres/${id}`),
  },

  reportes: {
    ventas: (desde?: string, hasta?: string) => {
      const query = new URLSearchParams();
      if (desde) query.set('desde', desde);
      if (hasta) query.set('hasta', hasta);
      return api.get<ReporteVentas>(`/reportes/ventas?${query.toString()}`);
    },
  },

  usuarios: {
    listar: (todas = false) => api.get<Usuario[]>(`/usuarios${todas ? '?todas=true' : ''}`),
    /** La paleta con quién tiene cada color. */
    paleta: () => api.get<ColorPaletaEstado[]>('/usuarios/paleta'),
    crear: (dto: CrearUsuarioDto) => api.post<Usuario>('/usuarios', dto),
    actualizar: (id: number, dto: ActualizarUsuarioDto) =>
      api.put<Usuario>(`/usuarios/${id}`, dto),
    cambiarActivo: (id: number, activo: boolean) =>
      api.patch<Usuario>(`/usuarios/${id}/activo`, { activo }),
  },

  configuracion: {
    todas: () => api.get<Record<string, string>>('/configuracion'),
    establecer: (clave: string, valor: string) =>
      api.put<Configuracion>(`/configuracion/${clave}`, { valor }),
  },

  health: () => api.get<{ ok: boolean; hora_servidor: string }>('/health'),
};
