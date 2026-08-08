import { formatearColones, type EstadoCobro } from '@brisas/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { mensajeDeError } from '../admin/api';
import { CLAVES_CAJA } from './api';

interface Props {
  cuentaId: number;
  cobro: EstadoCobro;
  onCambio: (nuevo: EstadoCobro) => void;
}

/**
 * "Cada quien lo suyo": dos paneles, asignación por toque.
 *
 * A la izquierda las líneas de la cuenta, a la derecha los comensales. Se toca
 * una línea y después el comensal al que le toca. Una línea se puede compartir
 * entre varios —tres personas se parten una picada— y una de cantidad 3 se
 * puede repartir 2 y 1 con el ± de cada comensal.
 *
 * El contador de líneas sin asignar está siempre a la vista, y el cobro no se
 * habilita hasta que llega a cero: una línea suelta es comida que no se le cobra
 * a nadie y que nadie va a notar hasta el cierre del día.
 */
export function PanelPorConsumo({ cuentaId, cobro, onCambio }: Props) {
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');

  // La ficha trae las líneas con su nombre y cantidad; el estado de cobro trae
  // quién tiene asignada cada una y por cuántas partes.
  const cuenta = useQuery({
    queryKey: CLAVES_CAJA.cuenta(cuentaId),
    queryFn: () => endpoints.cuentas.detalle(cuentaId),
  });

  const guardarComensales = useMutation({
    mutationFn: (comensales: Array<{ id?: number; etiqueta: string }>) =>
      endpoints.cobro.guardarComensales(cuentaId, { comensales }),
    onSuccess: onCambio,
  });

  const asignar = useMutation({
    mutationFn: (dto: { linea_id: number; comensales: Array<{ comensal_id: number; partes: number }> }) =>
      endpoints.cobro.asignarLineas(cuentaId, { asignaciones: [dto] }),
    onSuccess: onCambio,
  });

  const lineas = (cuenta.data?.pedidos ?? [])
    .flatMap((p) => p.lineas)
    .filter((l) => !l.anulada);

  /** Cuántas partes de esta línea tiene este comensal ahora mismo. */
  const partesDe = (lineaId: number, comensalId: number): number =>
    cobro.comensales
      .find((c) => c.id === comensalId)
      ?.lineas.find((l) => l.linea_id === lineaId)?.partes ?? 0;

  /** Quiénes tienen algo de esta línea. */
  const asignadosA = (lineaId: number) =>
    cobro.comensales.filter((c) => c.lineas.some((l) => l.linea_id === lineaId));

  const cambiarPartes = (lineaId: number, comensalId: number, delta: number) => {
    const actuales = cobro.comensales
      .flatMap((c) =>
        c.lineas
          .filter((l) => l.linea_id === lineaId)
          .map((l) => ({ comensal_id: c.id, partes: l.partes })),
      )
      .filter((a) => a.comensal_id !== comensalId);

    const nuevas = Math.max(0, partesDe(lineaId, comensalId) + delta);
    if (nuevas > 0) actuales.push({ comensal_id: comensalId, partes: nuevas });

    asignar.mutate({ linea_id: lineaId, comensales: actuales });
  };

  const repartirEntreTodos = (lineaId: number) => {
    asignar.mutate({
      linea_id: lineaId,
      comensales: cobro.comensales.map((c) => ({ comensal_id: c.id, partes: 1 })),
    });
  };

  const agregarComensal = () => {
    const etiqueta = nuevoNombre.trim() || `Comensal ${cobro.comensales.length + 1}`;
    guardarComensales.mutate([
      ...cobro.comensales.map((c) => ({ id: c.id, etiqueta: c.etiqueta })),
      { etiqueta },
    ]);
    setNuevoNombre('');
  };

  const renombrar = (id: number, etiqueta: string) => {
    guardarComensales.mutate(
      cobro.comensales.map((c) => ({ id: c.id, etiqueta: c.id === id ? etiqueta : c.etiqueta })),
    );
  };

  const quitar = (id: number) => {
    const quedan = cobro.comensales.filter((c) => c.id !== id);
    if (quedan.length === 0) return;
    guardarComensales.mutate(quedan.map((c) => ({ id: c.id, etiqueta: c.etiqueta })));
  };

  const error = asignar.error ?? guardarComensales.error;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">Asignar las líneas</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            cobro.sin_asignar.length === 0
              ? 'bg-green-100 text-green-800'
              : 'bg-amber-100 text-amber-900'
          }`}
        >
          {cobro.sin_asignar.length === 0
            ? 'Todo asignado'
            : `${cobro.sin_asignar.length} sin asignar`}
        </span>
        {seleccionada !== null && (
          <span className="text-sm text-slate-600">
            Tocá un comensal para darle la línea seleccionada.
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{mensajeDeError(error)}</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ── Panel izquierdo: las líneas ─────────────────────────────────── */}
        <div className="tarjeta">
          <h3 className="mb-2 font-semibold text-slate-700">Líneas de la cuenta</h3>
          <ul className="flex flex-col gap-1">
            {lineas.map((linea) => {
              const asignados = asignadosA(linea.id);
              const elegida = seleccionada === linea.id;
              return (
                <li key={linea.id}>
                  <button
                    onClick={() => setSeleccionada(elegida ? null : linea.id)}
                    className={`w-full rounded-lg border-2 p-2 text-left transition ${
                      elegida
                        ? 'border-marca bg-marca-claro'
                        : asignados.length > 0
                          ? 'border-transparent bg-slate-50'
                          : 'border-amber-300 bg-amber-50'
                    }`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-bold tabular-nums">{linea.cantidad}×</span>
                      <span className="min-w-0 flex-1 truncate">{linea.producto_nombre}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatearColones(linea.total)}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm">
                      {asignados.length === 0 ? (
                        <span className="font-medium text-amber-800">Sin asignar</span>
                      ) : (
                        <span className="text-slate-600">
                          {asignados
                            .map((c) => {
                              const partes = partesDe(linea.id, c.id);
                              return partes > 1 ? `${c.etiqueta} (${partes})` : c.etiqueta;
                            })
                            .join(' · ')}
                        </span>
                      )}
                    </span>
                  </button>

                  {elegida && cobro.comensales.length > 1 && (
                    <button
                      onClick={() => repartirEntreTodos(linea.id)}
                      className="mt-1 w-full rounded-lg bg-slate-100 py-1.5 text-sm font-medium text-slate-700"
                    >
                      Repartir entre todos por igual
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Panel derecho: los comensales ───────────────────────────────── */}
        <div className="tarjeta">
          <h3 className="mb-2 font-semibold text-slate-700">Comensales</h3>

          <ul className="flex flex-col gap-2">
            {cobro.comensales.map((comensal) => {
              const partes = seleccionada !== null ? partesDe(seleccionada, comensal.id) : 0;
              return (
                <li
                  key={comensal.id}
                  className={`flex items-center gap-2 rounded-lg border-2 p-2 ${
                    partes > 0 ? 'border-marca bg-marca-claro' : 'border-slate-200'
                  }`}
                >
                  <input
                    defaultValue={comensal.etiqueta}
                    onBlur={(e) => {
                      const valor = e.target.value.trim();
                      if (valor && valor !== comensal.etiqueta) renombrar(comensal.id, valor);
                    }}
                    aria-label="Nombre del comensal"
                    className="min-w-0 flex-1 rounded border-none bg-transparent px-1 font-medium focus:bg-white focus:ring-1 focus:ring-slate-300"
                  />

                  <span className="shrink-0 font-bold tabular-nums">
                    {formatearColones(comensal.total)}
                  </span>

                  {seleccionada !== null ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        aria-label="Quitar una parte"
                        disabled={partes === 0 || asignar.isPending}
                        onClick={() => cambiarPartes(seleccionada, comensal.id, -1)}
                        className="h-9 w-9 rounded-lg bg-white text-lg font-bold ring-1 ring-slate-300 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-bold tabular-nums">{partes}</span>
                      <button
                        aria-label="Darle una parte"
                        disabled={asignar.isPending}
                        onClick={() => cambiarPartes(seleccionada, comensal.id, 1)}
                        className="h-9 w-9 rounded-lg bg-white text-lg font-bold ring-1 ring-slate-300"
                      >
                        +
                      </button>
                    </span>
                  ) : (
                    cobro.comensales.length > 1 && (
                      <button
                        onClick={() => quitar(comensal.id)}
                        aria-label={`Quitar a ${comensal.etiqueta}`}
                        className="shrink-0 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
                      >
                        ×
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregarComensal()}
              placeholder="Nombre (opcional)"
              className="min-h-boton-normal min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <button
              className="boton-secundario shrink-0"
              disabled={guardarComensales.isPending}
              onClick={agregarComensal}
            >
              + Comensal
            </button>
          </div>

          {cobro.comensales.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">
              Agregá los comensales y después asignales las líneas.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
