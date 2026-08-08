import { formatearColones, type CategoriaAdmin, type ProductoAdmin } from '@brisas/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../../shared/api/endpoints';
import { Cargando, MensajeError } from '../../../shared/ui/Cargando';
import { Insignia } from '../../../shared/ui/Insignia';
import { ListaOrdenable } from '../../../shared/ui/ListaOrdenable';
import { CLAVES, mensajeDeError, useRefrescarMenu } from '../api';
import { FormularioCategoria } from './FormularioCategoria';
import { FormularioProducto } from './FormularioProducto';

export function PantallaMenu() {
  const refrescar = useRefrescarMenu();
  const [editandoProducto, setEditandoProducto] = useState<ProductoAdmin | 'nuevo' | null>(null);
  const [editandoCategoria, setEditandoCategoria] = useState<CategoriaAdmin | 'nueva' | null>(null);
  const [categoriaDestino, setCategoriaDestino] = useState<number | null>(null);

  const menu = useQuery({ queryKey: CLAVES.menuAdmin, queryFn: endpoints.menu.admin });
  const grupos = useQuery({ queryKey: CLAVES.gruposOpcion, queryFn: endpoints.menu.gruposOpcion });

  const reordenarCategorias = useMutation({
    mutationFn: endpoints.menu.reordenarCategorias,
    onSuccess: refrescar,
  });
  const reordenarProductos = useMutation({
    mutationFn: endpoints.menu.reordenarProductos,
    onSuccess: refrescar,
  });
  const limpiarAgotados = useMutation({
    mutationFn: endpoints.menu.limpiarAgotados,
    onSuccess: refrescar,
  });

  if (menu.isLoading) return <Cargando texto="Cargando el menú…" />;
  if (menu.isError) return <MensajeError texto={mensajeDeError(menu.error)} />;

  const categorias = menu.data ?? [];
  const nAgotados = categorias.reduce(
    (n, c) => n + c.productos.filter((p) => p.agotado).length,
    0,
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold">Menú</h2>
          <p className="text-sm text-slate-500">
            {categorias.length} categorías ·{' '}
            {categorias.reduce((n, c) => n + c.productos.length, 0)} productos
          </p>
        </div>

        {nAgotados > 0 && (
          <button
            className="boton-secundario"
            disabled={limpiarAgotados.isPending}
            onClick={() => limpiarAgotados.mutate()}
          >
            Devolver al menú {nAgotados} agotado{nAgotados === 1 ? '' : 's'}
          </button>
        )}
        <button className="boton-secundario" onClick={() => setEditandoCategoria('nueva')}>
          + Categoría
        </button>
        <button
          className="boton-primario"
          onClick={() => {
            setCategoriaDestino(categorias[0]?.id ?? null);
            setEditandoProducto('nuevo');
          }}
        >
          + Producto
        </button>
      </header>

      {/*
        Es el aviso más importante de esta pantalla. La dueña necesita saber que
        puede corregir precios a media tarde sin miedo.
      */}
      <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900 ring-1 ring-blue-200">
        <strong>Cambiar un precio no afecta las cuentas que ya están abiertas.</strong> Cada línea
        guarda el precio que tenía cuando se pidió, así que lo que ya se mandó a cocina se cobra
        igual. El precio nuevo aplica a los pedidos que entren de ahora en adelante.
      </p>

      {reordenarCategorias.isError && (
        <MensajeError texto={mensajeDeError(reordenarCategorias.error)} />
      )}
      {reordenarProductos.isError && (
        <MensajeError texto={mensajeDeError(reordenarProductos.error)} />
      )}

      <div className="flex flex-col gap-3">
        <ListaOrdenable
          elementos={categorias}
          idDe={(c) => c.id}
          onReordenar={(ids) => reordenarCategorias.mutate(ids)}
        >
          {(categoria, manija) => (
            <FilaCategoria
              key={categoria.id}
              categoria={categoria}
              manija={manija}
              onEditarCategoria={() => setEditandoCategoria(categoria)}
              onNuevoProducto={() => {
                setCategoriaDestino(categoria.id);
                setEditandoProducto('nuevo');
              }}
              onEditarProducto={setEditandoProducto}
              onReordenarProductos={(ids) => reordenarProductos.mutate(ids)}
            />
          )}
        </ListaOrdenable>
      </div>

      {editandoProducto && (
        <FormularioProducto
          producto={editandoProducto === 'nuevo' ? null : editandoProducto}
          categorias={categorias}
          categoriaInicial={categoriaDestino}
          gruposOpcion={grupos.data ?? []}
          onCerrar={() => setEditandoProducto(null)}
        />
      )}

      {editandoCategoria && (
        <FormularioCategoria
          categoria={editandoCategoria === 'nueva' ? null : editandoCategoria}
          onCerrar={() => setEditandoCategoria(null)}
        />
      )}
    </div>
  );
}

// ── Categoría ───────────────────────────────────────────────────────────────

function FilaCategoria({
  categoria,
  manija,
  onEditarCategoria,
  onNuevoProducto,
  onEditarProducto,
  onReordenarProductos,
}: {
  categoria: CategoriaAdmin;
  manija: React.ReactNode;
  onEditarCategoria: () => void;
  onNuevoProducto: () => void;
  onEditarProducto: (p: ProductoAdmin) => void;
  onReordenarProductos: (ids: number[]) => void;
}) {
  const [abierta, setAbierta] = useState(true);

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center gap-2 border-b bg-slate-50 px-3 py-2">
        {manija}

        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
          className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-slate-100"
        >
          <span aria-hidden className="text-slate-400">
            {abierta ? '▾' : '▸'}
          </span>
          <span className="font-semibold">{categoria.nombre}</span>
          <span className="text-sm text-slate-500">({categoria.productos.length})</span>
          {!categoria.activo && <Insignia tono="alerta">Categoría oculta</Insignia>}
        </button>

        <button className="boton-secundario text-sm" onClick={onNuevoProducto}>
          + Producto
        </button>
        <button className="boton-secundario text-sm" onClick={onEditarCategoria}>
          Editar
        </button>
      </header>

      {abierta && (
        <div className="divide-y divide-slate-100">
          {categoria.productos.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Esta categoría no tiene productos todavía.
            </p>
          ) : (
            <ListaOrdenable
              elementos={categoria.productos}
              idDe={(p) => p.id}
              onReordenar={onReordenarProductos}
            >
              {(producto, manijaProducto) => (
                <FilaProducto
                  key={producto.id}
                  producto={producto}
                  manija={manijaProducto}
                  onEditar={() => onEditarProducto(producto)}
                />
              )}
            </ListaOrdenable>
          )}
        </div>
      )}
    </section>
  );
}

// ── Producto ────────────────────────────────────────────────────────────────

function FilaProducto({
  producto,
  manija,
  onEditar,
}: {
  producto: ProductoAdmin;
  manija: React.ReactNode;
  onEditar: () => void;
}) {
  const refrescar = useRefrescarMenu();

  const cambiarActivo = useMutation({
    mutationFn: (activo: boolean) => endpoints.menu.cambiarActivo(producto.id, activo),
    onSuccess: refrescar,
  });
  const marcarAgotado = useMutation({
    mutationFn: (agotado: boolean) => endpoints.menu.marcarAgotado(producto.id, agotado),
    onSuccess: refrescar,
  });

  const sinPrecio = producto.variantes.every((v) => v.precio_colones === null);
  const ocupado = cambiarActivo.isPending || marcarAgotado.isPending;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${producto.activo ? '' : 'bg-slate-50'}`}>
      {manija}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium ${producto.activo ? '' : 'text-slate-400 line-through'}`}>
            {producto.nombre_es}
          </span>
          {producto.es_envase && <Insignia tono="info">Envase</Insignia>}
          {sinPrecio && <Insignia tono="alerta">Sin precio</Insignia>}
          {producto.agotado && <Insignia tono="aviso">Agotado hoy</Insignia>}
          {!producto.activo && <Insignia>Desactivado</Insignia>}
        </div>

        <p className="truncate text-sm text-slate-500">
          {producto.variantes.map((v) => (
            <span key={v.id} className={v.activo ? '' : 'line-through opacity-50'}>
              {producto.variantes.length > 1 && `${v.etiqueta}: `}
              {v.precio_colones === null ? '—' : formatearColones(v.precio_colones)}
              {'   '}
            </span>
          ))}
        </p>
      </div>

      <button
        type="button"
        disabled={ocupado}
        onClick={() => marcarAgotado.mutate(!producto.agotado)}
        title="Se sigue viendo en el menú, pero no se puede pedir hoy"
        className={`min-h-boton-normal rounded-lg px-3 text-sm font-medium disabled:opacity-40 ${
          producto.agotado
            ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
            : 'text-slate-500 hover:bg-slate-100'
        }`}
      >
        {producto.agotado ? 'Se agotó' : 'Marcar agotado'}
      </button>

      <button
        type="button"
        disabled={ocupado}
        onClick={() => cambiarActivo.mutate(!producto.activo)}
        title={producto.activo ? 'Dejar de venderlo' : 'Volver a venderlo'}
        className="min-h-boton-normal rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
      >
        {producto.activo ? 'Desactivar' : 'Activar'}
      </button>

      <button className="boton-secundario text-sm" onClick={onEditar}>
        Editar
      </button>
    </div>
  );
}
