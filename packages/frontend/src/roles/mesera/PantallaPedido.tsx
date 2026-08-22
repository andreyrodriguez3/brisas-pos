import {
  CLAVES_CONFIG,
  PRECIO_ENVASE_DEFAULT,
  envasesNecesarios,
  formatearColones,
  totalEnvases as calcularTotalEnvases,
  type CanalCuenta,
  type ProductoCompleto,
} from '@brisas/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { endpoints } from '../../shared/api/endpoints';
import { Cargando, MensajeError } from '../../shared/ui/Cargando';
import { Insignia } from '../../shared/ui/Insignia';
import { mensajeDeError } from '../admin/api';
import { HojaOpciones } from './HojaOpciones';
import { CLAVES_MESERA, useEnviarPedido } from './useEnviarPedido';
import { aLineasDto, subtotalCarrito, totalItem, useCarrito } from './estado/carrito';

/** Sin tildes y en minúsculas, para que "cafe" encuentre "Café". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Tomar el pedido: categorías en pestañas, platillos en lista, carrito abajo con
 * el subtotal SIEMPRE visible.
 *
 * `base` existe porque caja toma los pedidos telefónicos con esta misma
 * pantalla: es exactamente el mismo trabajo —elegir platillos y mandarlos a
 * cocina— y duplicarla sería mantener dos veces la hoja de opciones y el
 * carrito. Lo único que cambia es a dónde vuelve al terminar.
 */
export function PantallaPedido({ base = '/mesera' }: { base?: string } = {}) {
  const { id } = useParams<{ id: string }>();
  const cuentaId = Number(id);
  const navegar = useNavigate();

  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null);
  const [productoAbierto, setProductoAbierto] = useState<ProductoCompleto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const { items, agregar, cambiarCantidad, vaciar, abrirPara } = useCarrito();
  const { enviar, enviando, error, limpiarError } = useEnviarPedido();

  const cuenta = useQuery({
    queryKey: CLAVES_MESERA.cuenta(cuentaId),
    queryFn: () => endpoints.cuentas.detalle(cuentaId),
  });
  const menu = useQuery({ queryKey: CLAVES_MESERA.menu, queryFn: endpoints.menu.catalogo });
  // El precio del envase se lee de `configuracion`, nunca se hardcodea: si la
  // dueña lo sube, la pantalla lo refleja sin tocar código.
  const config = useQuery({
    queryKey: ['configuracion'],
    queryFn: endpoints.configuracion.todas,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!Number.isNaN(cuentaId)) abrirPara(cuentaId);
  }, [cuentaId, abrirPara]);

  useEffect(() => {
    if (categoriaActiva === null && menu.data?.length) setCategoriaActiva(menu.data[0].id);
  }, [menu.data, categoriaActiva]);

  if (cuenta.isLoading || menu.isLoading) return <Cargando texto="Cargando el menú…" />;
  if (cuenta.isError) return <MensajeError texto={mensajeDeError(cuenta.error)} />;
  if (menu.isError) return <MensajeError texto={mensajeDeError(menu.error)} />;

  const categorias = menu.data ?? [];
  const categoria = categorias.find((c) => c.id === categoriaActiva) ?? categorias[0];
  const canal = (cuenta.data?.canal ?? 'SALON') as CanalCuenta;

  const buscando = busqueda.trim().length > 0;
  const terminoBuscado = normalizar(busqueda.trim());
  const resultadosBusqueda = buscando
    ? categorias
        .flatMap((c) => c.productos.map((p) => ({ ...p, categoriaNombre: c.nombre })))
        .filter((p) =>
          [p.nombre_es, p.nombre_en, p.descripcion]
            .filter((texto): texto is string => Boolean(texto))
            .some((texto) => normalizar(texto).includes(terminoBuscado)),
        )
    : [];

  const subtotal = subtotalCarrito(items);
  // Se muestra el envase ANTES de mandar, con la misma regla que usa el
  // servidor: la mesera no debería enterarse del cargo cuando ya cobró.
  const envases = envasesNecesarios(
    canal,
    items.map((i) => ({ cantidad: i.cantidad, para_llevar: i.para_llevar, es_envase: false })),
  );
  const precioEnvase =
    Number.parseInt(config.data?.[CLAVES_CONFIG.PRECIO_ENVASE] ?? '', 10) || PRECIO_ENVASE_DEFAULT;
  const totalEnvases = calcularTotalEnvases(envases, precioEnvase);

  async function mandarACocina() {
    if (items.length === 0) return;
    limpiarError();
    try {
      const resultado = await enviar({
        cuenta_id: cuentaId,
        cuenta_nombre: cuenta.data?.nombre_cliente ?? '',
        lineas: aLineasDto(items),
      });
      vaciar();
      setAviso(
        resultado === 'enviado'
          ? 'Pedido enviado a cocina'
          : 'Sin señal: el pedido quedó guardado y sale solo cuando vuelva',
      );
      setTimeout(() => navegar(`${base}/cuenta/${cuentaId}`), 900);
    } catch {
      // El error queda en `error` y se muestra abajo.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b bg-white px-4 py-2">
        <button
          onClick={() => navegar(`${base}/cuenta/${cuentaId}`)}
          className="text-sm text-slate-500"
        >
          ← {cuenta.data?.nombre_cliente}
        </button>
      </header>

      {/* Buscador: mientras tiene texto, reemplaza las pestañas por una lista plana. */}
      <div className="border-b border-slate-200/70 bg-white px-4 py-2 shadow-sm">
        <div className="relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar platillo…"
            className="min-h-tactil w-full rounded-full border border-slate-200/70 bg-slate-50 px-4 pr-10 text-sm"
          />
          {buscando && (
            <button
              aria-label="Limpiar búsqueda"
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Pestañas horizontales de categorías: ocultas mientras se busca. */}
      {!buscando && (
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200/70 bg-white px-4 py-2 shadow-sm">
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaActiva(c.id)}
              className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-semibold ${
                c.id === categoria?.id ? 'bg-marca text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </nav>
      )}

      <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto bg-white">
        {buscando && resultadosBusqueda.length === 0 && (
          <li className="px-4 py-8 text-center text-slate-500">
            Sin resultados para «{busqueda.trim()}»
          </li>
        )}

        {(buscando ? resultadosBusqueda : (categoria?.productos ?? [])).map((p) => (
          <li key={p.id}>
            <button
              onClick={() => setProductoAbierto(p)}
              disabled={p.agotado}
              className="flex min-h-tactil w-full items-center gap-3 px-4 py-4 text-left transition active:bg-slate-50 disabled:opacity-40"
            >
              <span className="min-w-0 flex-1">
                {buscando && (
                  <span className="block text-xs text-slate-400">
                    {(p as { categoriaNombre?: string }).categoriaNombre}
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium leading-snug">{p.nombre_es}</span>
                  {p.agotado && <Insignia tono="aviso">Agotado</Insignia>}
                </span>
                {p.descripcion && (
                  <span className="mt-0.5 block truncate text-sm text-slate-500">
                    {p.descripcion}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatearColones(p.variantes[0]?.precio_colones ?? 0)}
                {p.variantes.length > 1 && <span className="text-slate-400">+</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* ── Carrito: el subtotal SIEMPRE a la vista ────────────────────────── */}
      <footer className="border-t bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        {aviso && (
          <p className="bg-green-600 px-4 py-2 text-center font-medium text-white">{aviso}</p>
        )}
        {error && <MensajeError texto={error} />}

        {items.length > 0 && (
          <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto">
            {items.map((item) => (
              <li key={item.clave} className="flex items-center gap-2 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.producto.nombre_es}
                    {item.producto.variantes.length > 1 && ` (${item.variante.etiqueta})`}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {item.opciones.map((o) => o.opcion.nombre).join(' · ')}
                    {item.nota && ` · ${item.nota.toUpperCase()}`}
                    {item.para_llevar && ' · SE LO LLEVA'}
                  </p>
                </div>

                <button
                  aria-label="Menos"
                  onClick={() => cambiarCantidad(item.clave, item.cantidad - 1)}
                  className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 text-lg font-bold"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold tabular-nums">{item.cantidad}</span>
                <button
                  aria-label="Más"
                  onClick={() => cambiarCantidad(item.clave, item.cantidad + 1)}
                  className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 text-lg font-bold"
                >
                  +
                </button>

                <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {formatearColones(totalItem(item))}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-slate-600">
              {items.length === 0
                ? 'Tocá un platillo para agregarlo'
                : `${items.length} ${items.length === 1 ? 'ítem' : 'ítems'}`}
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {formatearColones(subtotal + totalEnvases)}
            </span>
          </div>

          {envases > 0 && (
            <p className="mb-2 text-sm text-amber-800">
              Incluye {envases} envase{envases === 1 ? '' : 's'} ({formatearColones(totalEnvases)}).
              {canal === 'SALON' && ' La comida sigue contando como venta de salón.'}
            </p>
          )}

          <button
            className="boton-primario min-h-tactil w-full text-lg"
            disabled={items.length === 0 || enviando}
            onClick={() => void mandarACocina()}
          >
            {enviando ? 'Enviando…' : 'Enviar a cocina'}
          </button>
        </div>
      </footer>

      {productoAbierto && (
        <HojaOpciones
          producto={productoAbierto}
          onAgregar={agregar}
          onCerrar={() => setProductoAbierto(null)}
        />
      )}
    </div>
  );
}
