import { EstadoLinea, EstadoPedido, formatearColones, type LineaCompleta } from '@brisas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { endpoints } from '../../shared/api/endpoints';
import { useSesion } from '../../shared/estado/sesion';
import { Cargando, MensajeError } from '../../shared/ui/Cargando';
import { Insignia } from '../../shared/ui/Insignia';
import { mensajeDeError } from '../admin/api';
import { CLAVES_MESERA } from './useEnviarPedido';

const ESTADO: Record<EstadoPedido, { texto: string; tono: 'aviso' | 'info' | 'ok' | 'neutro' }> = {
  ENVIADO: { texto: 'En cola', tono: 'aviso' },
  EN_PREPARACION: { texto: 'Preparando', tono: 'info' },
  LISTO: { texto: '¡Listo!', tono: 'ok' },
  ENTREGADO: { texto: 'Entregado', tono: 'neutro' },
};

/** Ficha de la cuenta: sus pedidos agrupados, con el total y el botón de agregar. */
export function PantallaCuenta() {
  const { id } = useParams<{ id: string }>();
  const cuentaId = Number(id);
  const navegar = useNavigate();
  const usuario = useSesion((s) => s.usuario);

  const cuenta = useQuery({
    queryKey: CLAVES_MESERA.cuenta(cuentaId),
    queryFn: () => endpoints.cuentas.detalle(cuentaId),
  });

  if (cuenta.isLoading) return <Cargando />;
  if (cuenta.isError) return <MensajeError texto={mensajeDeError(cuenta.error)} />;
  if (!cuenta.data) return null;

  const c = cuenta.data;
  const esAjena = c.mesera_responsable_id !== usuario?.id && c.mesera_nombre !== null;

  return (
    <div className="flex flex-1 flex-col pb-24">
      <header
        className="border-b-4 bg-white px-4 py-3 shadow-sm"
        style={{ borderBottomColor: c.mesera_color ?? '#475569' }}
      >
        <button onClick={() => navegar('/mesera')} className="text-sm text-slate-500">
          ← Cuentas
        </button>
        <h1 className="mt-1 text-xl font-bold">{c.nombre_cliente}</h1>
        <p className="text-sm text-slate-600">
          {c.mesera_nombre ?? 'Sin mesera'}
          {c.referencia && ` · ${c.referencia}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.canal === 'PARA_LLEVAR' && <Insignia tono="info">Para llevar</Insignia>}
          {esAjena && <Insignia tono="aviso">Cuenta de {c.mesera_nombre}</Insignia>}
          {c.editada_por_terceros && <Insignia>Editada por otra mesera</Insignia>}
        </div>
      </header>

      {esAjena && (
        <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Lo que cambiés acá queda registrado a tu nombre. La cuenta sigue siendo de{' '}
          {c.mesera_nombre}.
        </p>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        {c.pedidos.length === 0 && (
          <p className="py-8 text-center text-slate-500">
            Esta cuenta todavía no tiene pedidos.
          </p>
        )}

        {c.pedidos.map((pedido) => (
          <section key={pedido.id} className="tarjeta">
            <header className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-semibold">Comanda #{pedido.consecutivo_dia}</span>
              {pedido.es_agregado && <Insignia tono="aviso">Agregado</Insignia>}
              <Insignia tono={ESTADO[pedido.estado as EstadoPedido].tono}>
                {ESTADO[pedido.estado as EstadoPedido].texto}
              </Insignia>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  {new Date(pedido.creado_en).toLocaleTimeString('es-CR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {pedido.estado === EstadoPedido.LISTO && (
                  <BotonEntregar pedidoId={pedido.id} cuentaId={cuentaId} />
                )}
              </span>
            </header>

            <ul className="divide-y divide-slate-100">
              {pedido.lineas
                .filter((l) => !l.anulada)
                .map((linea) => (
                  <FilaLinea key={linea.id} linea={linea} cuentaId={cuentaId} />
                ))}
            </ul>

            {pedido.creado_por_nombre && (
              <p className="mt-2 text-xs text-slate-400">Enviado por {pedido.creado_por_nombre}</p>
            )}
          </section>
        ))}
      </div>

      <footer className="sticky bottom-0 border-t bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-slate-600">Total</span>
          <span className="text-2xl font-bold tabular-nums">{formatearColones(c.total)}</span>
        </div>
        <button
          className="boton-primario min-h-tactil w-full text-lg"
          onClick={() => navegar(`/mesera/cuenta/${cuentaId}/pedido`)}
        >
          + Agregar pedido
        </button>
      </footer>
    </div>
  );
}

/**
 * La mesera también puede marcar ENTREGADO, además de cocina — es quien de
 * verdad sabe cuándo el plato salió de la cocina. Sin diálogo de confirmación:
 * un toque, y el cambio queda auditado igual que cualquier otro.
 */
function BotonEntregar({ pedidoId, cuentaId }: { pedidoId: number; cuentaId: number }) {
  const cliente = useQueryClient();

  const entregar = useMutation({
    mutationFn: () => endpoints.pedidos.cambiarEstado(pedidoId, EstadoPedido.ENTREGADO),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuenta(cuentaId) });
      void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuentas });
    },
  });

  return (
    <button
      disabled={entregar.isPending}
      onClick={() => entregar.mutate()}
      className="shrink-0 rounded-lg bg-marca px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
    >
      {entregar.isPending ? 'Marcando…' : 'Marcar entregado'}
    </button>
  );
}

function FilaLinea({ linea, cuentaId }: { linea: LineaCompleta; cuentaId: number }) {
  const cliente = useQueryClient();
  // El gate mira el estado de ESTA línea, no el de la comanda: con cocina
  // trabajando por platillo, un pedido puede tener un plato LISTO y otro
  // todavía EN COLA al mismo tiempo.
  const puedeEditar = linea.estado_linea === EstadoLinea.ENVIADO;
  const estado = ESTADO[linea.estado_linea as EstadoPedido];

  const invalidar = () => {
    void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuenta(cuentaId) });
    void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuentas });
  };

  const marcar = useMutation({
    mutationFn: (para_llevar: boolean) => endpoints.pedidos.editarLinea(linea.id, { para_llevar }),
    onSuccess: invalidar,
  });

  const cambiarCantidad = useMutation({
    mutationFn: (cantidad: number) => endpoints.pedidos.editarLinea(linea.id, { cantidad }),
    onSuccess: invalidar,
  });

  // Sin motivo: es una acción frecuente y automática, como el ajuste de
  // envases. Pedirle motivo a la mesera acá sería fricción innecesaria.
  const quitar = useMutation({
    mutationFn: () =>
      endpoints.pedidos.anularLinea(linea.id, 'Quitada por la mesera antes de que cocina la preparara'),
    onSuccess: invalidar,
  });

  return (
    <li className="flex items-start gap-2 py-2">
      <span className="w-8 shrink-0 font-bold tabular-nums">{linea.cantidad}×</span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 font-medium">
          {linea.producto_nombre}
          {linea.variante_etiqueta !== 'Único' && (
            <span className="text-slate-500"> ({linea.variante_etiqueta})</span>
          )}
          {/* Solo cuando el plato ya avanzó: en ENVIADO (el caso común) sería
              ruido, ya lo dice el encabezado de la comanda. */}
          {linea.estado_linea !== EstadoLinea.ENVIADO && !linea.es_envase && (
            <Insignia tono={estado.tono}>{estado.texto}</Insignia>
          )}
        </p>
        {linea.opciones.length > 0 && (
          <p className="text-sm text-slate-500">
            {linea.opciones.map((o) => o.nombre_snapshot).join(' · ')}
          </p>
        )}
        {linea.nota && <p className="nota-cliente mt-1 inline-block text-sm">{linea.nota}</p>}

        {/* El envase no se puede marcar "para llevar": es el empaque, no comida. */}
        {!linea.es_envase && (
          <button
            disabled={marcar.isPending}
            onClick={() => marcar.mutate(!linea.para_llevar)}
            className={`mt-1 block rounded-md px-2 py-1 text-xs font-semibold ${
              linea.para_llevar
                ? 'bg-amber-100 text-amber-900'
                : 'text-slate-400 hover:bg-slate-100'
            }`}
          >
            {linea.para_llevar ? '✓ SE LO LLEVA · con envase' : 'Marcar que se lo lleva'}
          </button>
        )}

        {/* Cocina todavía no la empezó: se puede cambiar la cantidad o quitarla.
            En cuanto pasa a EN_PREPARACION, la línea queda de solo lectura. */}
        {puedeEditar && (
          <div className="mt-2 flex items-center gap-2">
            <button
              aria-label="Menos"
              disabled={cambiarCantidad.isPending || linea.cantidad <= 1}
              onClick={() => cambiarCantidad.mutate(linea.cantidad - 1)}
              className="h-8 w-8 shrink-0 rounded-lg bg-slate-100 text-base font-bold disabled:opacity-40"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-bold tabular-nums">
              {linea.cantidad}
            </span>
            <button
              aria-label="Más"
              disabled={cambiarCantidad.isPending}
              onClick={() => cambiarCantidad.mutate(linea.cantidad + 1)}
              className="h-8 w-8 shrink-0 rounded-lg bg-slate-100 text-base font-bold disabled:opacity-40"
            >
              +
            </button>
            <button
              disabled={quitar.isPending}
              onClick={() => quitar.mutate()}
              className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {quitar.isPending ? 'Quitando…' : 'Quitar'}
            </button>
          </div>
        )}

        {marcar.isError && (
          <p className="mt-1 text-xs text-red-700">{mensajeDeError(marcar.error)}</p>
        )}
        {cambiarCantidad.isError && (
          <p className="mt-1 text-xs text-red-700">{mensajeDeError(cambiarCantidad.error)}</p>
        )}
        {quitar.isError && (
          <p className="mt-1 text-xs text-red-700">{mensajeDeError(quitar.error)}</p>
        )}
      </div>

      <span className="shrink-0 font-semibold tabular-nums">{formatearColones(linea.total)}</span>
    </li>
  );
}
