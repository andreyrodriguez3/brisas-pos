import {
  COLOR_SIN_MESERA,
  CanalCuenta,
  EstadoCuenta,
  formatearColones,
  type EstadoPedido,
} from '@brisas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { endpoints } from '../../shared/api/endpoints';
import { Cargando, MensajeError } from '../../shared/ui/Cargando';
import { Insignia } from '../../shared/ui/Insignia';
import { mensajeDeError } from '../admin/api';
import { Bitacora } from './Bitacora';
import { ModalAnular } from './ModalAnular';
import { ModalDescuento } from './ModalDescuento';
import { CLAVES_CAJA } from './api';

const ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  ENVIADO: 'En cola',
  EN_PREPARACION: 'Preparando',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
};

/**
 * Ficha de la cuenta en caja.
 *
 * Las líneas van agrupadas por pedido con su hora, porque así fue como
 * entraron a cocina y así es como el cliente las va a reclamar: "lo que pedimos
 * después no llegó".
 */
export function FichaCuenta() {
  const { id } = useParams<{ id: string }>();
  const cuentaId = Number(id);
  const navegar = useNavigate();
  const cliente = useQueryClient();

  const [modal, setModal] = useState<'descuento' | 'anular' | null>(null);

  const cuenta = useQuery({
    queryKey: CLAVES_CAJA.cuenta(cuentaId),
    queryFn: () => endpoints.cuentas.detalle(cuentaId),
  });
  const cobro = useQuery({
    queryKey: CLAVES_CAJA.cobro(cuentaId),
    queryFn: () => endpoints.cobro.estado(cuentaId),
  });

  const refrescar = () => {
    void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.cuenta(cuentaId) });
    void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.cobro(cuentaId) });
    void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.bitacora(cuentaId) });
    void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.cuentas });
  };

  /** Cortesía: el total queda en cero y no hay ningún pago que registrar. */
  const cerrarSinSaldo = useMutation({
    mutationFn: () => endpoints.cobro.cerrar(cuentaId),
    onSuccess: refrescar,
  });

  if (cuenta.isLoading || cobro.isLoading) return <Cargando />;
  if (cuenta.isError) return <MensajeError texto={mensajeDeError(cuenta.error)} />;
  if (cobro.isError) return <MensajeError texto={mensajeDeError(cobro.error)} />;
  if (!cuenta.data || !cobro.data) return null;

  const c = cuenta.data;
  const e = cobro.data;
  const cerrada = c.estado === EstadoCuenta.COBRADA || c.estado === EstadoCuenta.ANULADA;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <button onClick={() => navegar('/caja')} className="self-start text-sm text-slate-500">
        ← Tablero
      </button>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* ── Izquierda: la comida ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <header
            className="tarjeta-mesera"
            style={{ borderLeftColor: c.mesera_color ?? COLOR_SIN_MESERA }}
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold">{c.nombre_cliente}</h1>
                <p className="text-slate-600">
                  {c.mesera_nombre ?? 'Sin mesera'}
                  {c.referencia && ` · ${c.referencia}`}
                  {c.telefono && ` · ${c.telefono}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.canal === CanalCuenta.PARA_LLEVAR && <Insignia tono="info">Para llevar</Insignia>}
                {c.estado === EstadoCuenta.EN_COBRO && <Insignia tono="aviso">En cobro</Insignia>}
                {c.estado === EstadoCuenta.COBRADA && <Insignia tono="ok">Cobrada</Insignia>}
                {c.estado === EstadoCuenta.ANULADA && <Insignia tono="aviso">Anulada</Insignia>}
                {c.editada_por_terceros && <Insignia>Editada por otra mesera</Insignia>}
              </div>
            </div>
            {c.hora_retiro && (
              <p className="mt-2 text-sm text-slate-600">
                Retiro:{' '}
                {new Date(c.hora_retiro).toLocaleTimeString('es-CR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </header>

          {c.pedidos.map((pedido) => (
            <section key={pedido.id} className="tarjeta">
              <header className="mb-2 flex flex-wrap items-center gap-2 border-b pb-2">
                <span className="font-semibold">Comanda #{pedido.consecutivo_dia}</span>
                {pedido.es_agregado && <Insignia tono="aviso">Agregado</Insignia>}
                <Insignia tono={pedido.estado === 'ENTREGADO' ? 'neutro' : 'info'}>
                  {ESTADO_PEDIDO[pedido.estado as EstadoPedido]}
                </Insignia>
                <span className="ml-auto text-sm text-slate-500">
                  {new Date(pedido.creado_en).toLocaleTimeString('es-CR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {pedido.creado_por_nombre}
                </span>
              </header>

              <ul className="divide-y divide-slate-100">
                {pedido.lineas.map((linea) => (
                  <li
                    key={linea.id}
                    className={`flex items-start gap-3 py-2 ${linea.anulada ? 'opacity-40' : ''}`}
                  >
                    <span className="w-8 shrink-0 font-bold tabular-nums">{linea.cantidad}×</span>
                    <div className="min-w-0 flex-1">
                      <p className={linea.anulada ? 'line-through' : ''}>
                        {linea.producto_nombre}
                        {linea.variante_etiqueta !== 'Único' && (
                          <span className="text-slate-500"> ({linea.variante_etiqueta})</span>
                        )}
                      </p>
                      {linea.opciones.length > 0 && (
                        <p className="text-sm text-slate-500">
                          {linea.opciones.map((o) => o.nombre_snapshot).join(' · ')}
                        </p>
                      )}
                      {linea.nota && (
                        <p className="nota-cliente mt-1 inline-block text-xs">{linea.nota}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatearColones(linea.total)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-2 text-right text-sm text-slate-500">
                Comanda: <span className="font-semibold">{formatearColones(pedido.total)}</span>
              </p>
            </section>
          ))}

          <Bitacora cuentaId={cuentaId} />
        </div>

        {/* ── Derecha: la plata ───────────────────────────────────────────── */}
        <aside className="flex h-fit flex-col gap-3 lg:sticky lg:top-4">
          <section className="tarjeta">
            <dl className="flex flex-col gap-1.5 text-sm">
              <Fila etiqueta="Consumo" monto={e.subtotal} />

              {c.descuentos.map((d, i) => (
                <Fila
                  key={d.id}
                  etiqueta={
                    d.tipo === 'CORTESIA'
                      ? 'Cortesía'
                      : d.tipo === 'PORCENTAJE'
                        ? `Descuento ${d.valor}%`
                        : 'Descuento'
                  }
                  detalle={d.motivo}
                  monto={-(e.detalle_descuentos[i] ?? 0)}
                  tono="descuento"
                />
              ))}

              <div className="mt-1 flex items-baseline justify-between border-t pt-2">
                <dt className="font-semibold">Total</dt>
                <dd className="text-2xl font-bold tabular-nums">{formatearColones(e.total)}</dd>
              </div>

              {e.pagado > 0 && (
                <>
                  <Fila etiqueta="Pagado" monto={e.pagado} />
                  <div className="flex items-baseline justify-between border-t pt-2">
                    <dt className="font-semibold">Saldo</dt>
                    <dd className="text-xl font-bold tabular-nums text-red-700">
                      {formatearColones(e.saldo)}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            {e.advertencias.length > 0 && !cerrada && (
              <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {e.advertencias.map((a) => (
                  <li key={a}>⚠ {a}</li>
                ))}
              </ul>
            )}
          </section>

          {!cerrada && (
            <div className="flex flex-col gap-2">
              {e.saldo > 0 ? (
                <button
                  className="boton-primario w-full text-base"
                  onClick={() => navegar(`/caja/cuenta/${cuentaId}/cobro`)}
                >
                  Cobrar {formatearColones(e.saldo)}
                </button>
              ) : (
                <button
                  className="boton-primario w-full text-base"
                  disabled={cerrarSinSaldo.isPending}
                  onClick={() => cerrarSinSaldo.mutate()}
                >
                  Cerrar la cuenta (sin saldo)
                </button>
              )}

              <button className="boton-secundario w-full" onClick={() => setModal('descuento')}>
                Descuento o cortesía
              </button>
              <button
                className="boton-secundario w-full"
                onClick={() => navegar(`/caja/cuenta/${cuentaId}/pedido`)}
              >
                Agregar pedido
              </button>
              <button className="boton-secundario w-full text-red-700" onClick={() => setModal('anular')}>
                Anular la cuenta
              </button>

              {cerrarSinSaldo.isError && (
                <p className="text-sm text-red-700">{mensajeDeError(cerrarSinSaldo.error)}</p>
              )}
            </div>
          )}

          {c.pagos.length > 0 && (
            <section className="tarjeta">
              <h2 className="mb-2 font-semibold">Pagos registrados</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {c.pagos.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="text-slate-600">
                      {p.forma_pago}
                      {p.parte_num ? ` · parte ${p.parte_num}` : ''}
                    </span>
                    <span className="font-semibold tabular-nums">{formatearColones(p.monto)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">
                La forma de pago es informativa: el sistema no procesa cobros.
              </p>
            </section>
          )}
        </aside>
      </div>

      <ModalDescuento
        cuentaId={cuentaId}
        total={e.total}
        abierto={modal === 'descuento'}
        onCerrar={() => setModal(null)}
        onListo={refrescar}
      />
      <ModalAnular
        cuentaId={cuentaId}
        abierto={modal === 'anular'}
        onCerrar={() => setModal(null)}
        onListo={() => {
          refrescar();
          navegar('/caja');
        }}
      />
    </div>
  );
}

function Fila({
  etiqueta,
  detalle,
  monto,
  tono,
}: {
  etiqueta: string;
  detalle?: string;
  monto: number;
  tono?: 'descuento';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`min-w-0 ${tono === 'descuento' ? 'text-green-800' : 'text-slate-600'}`}>
        {etiqueta}
        {detalle && <span className="block truncate text-xs text-slate-400">« {detalle} »</span>}
      </dt>
      <dd
        className={`shrink-0 tabular-nums ${tono === 'descuento' ? 'font-medium text-green-800' : ''}`}
      >
        {monto < 0 ? `−${formatearColones(-monto)}` : formatearColones(monto)}
      </dd>
    </div>
  );
}
