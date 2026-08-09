import { ModoDivision, formatearColones, type EstadoCobro, type ParteCobro } from '@brisas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { endpoints } from '../../shared/api/endpoints';
import { Cargando, MensajeError } from '../../shared/ui/Cargando';
import { ModalPago } from './ModalPago';
import { PanelPorConsumo } from './PanelPorConsumo';
import { CLAVES_CAJA } from './api';
import { mensajeDeError } from '../admin/api';

const MODOS = [
  {
    valor: ModoDivision.TOTAL,
    titulo: 'Todo junto',
    ayuda: 'Un solo pago por el total. Es lo más rápido.',
  },
  {
    valor: ModoDivision.PARTES_IGUALES,
    titulo: 'Partes iguales',
    ayuda: 'Se divide entre 2, 3, 4… El sobrante va a la primera parte.',
  },
  {
    valor: ModoDivision.POR_CONSUMO,
    titulo: 'Cada quien lo suyo',
    ayuda: 'Cada línea se le asigna a un comensal. Se pueden compartir.',
  },
] as const;

/** Cobro de una cuenta, en las tres modalidades del plan. */
export function PantallaCobro() {
  const { id } = useParams<{ id: string }>();
  const cuentaId = Number(id);
  const navegar = useNavigate();
  const cliente = useQueryClient();

  const [cobrando, setCobrando] = useState<ParteCobro | null>(null);

  const cobro = useQuery({
    queryKey: CLAVES_CAJA.cobro(cuentaId),
    queryFn: () => endpoints.cobro.estado(cuentaId),
  });

  const refrescar = (nuevo?: EstadoCobro) => {
    if (nuevo) cliente.setQueryData(CLAVES_CAJA.cobro(cuentaId), nuevo);
    void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.cuenta(cuentaId) });
    void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.cuentas });
    void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.bitacora(cuentaId) });
  };

  const fijarModo = useMutation({
    mutationFn: (dto: { modo: ModoDivision; n_partes?: number | null }) =>
      endpoints.cobro.fijarDivision(cuentaId, dto),
    onSuccess: refrescar,
  });

  if (cobro.isLoading) return <Cargando />;
  if (cobro.isError) return <MensajeError texto={mensajeDeError(cobro.error)} />;
  if (!cobro.data) return null;

  const e = cobro.data;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <button
        onClick={() => navegar(`/caja/cuenta/${cuentaId}`)}
        className="self-start text-sm text-slate-500"
      >
        ← Volver a la cuenta
      </button>

      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 className="text-2xl font-bold">Cobrar</h1>
        <p className="text-slate-600">
          Total <span className="font-semibold tabular-nums">{formatearColones(e.total)}</span>
          {e.pagado > 0 && (
            <>
              {' · '}pagado{' '}
              <span className="font-semibold tabular-nums">{formatearColones(e.pagado)}</span>
              {' · '}falta{' '}
              <span className="font-semibold tabular-nums text-red-700">
                {formatearColones(e.saldo)}
              </span>
            </>
          )}
        </p>
      </header>

      {/* ── Elegir la modalidad ───────────────────────────────────────────── */}
      {/* Una vez que hay un pago registrado, la división queda fija: cambiarla
          desordenaría a quién le corresponde cada pago ya hecho. */}
      {e.pagado > 0 && (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          Ya se registró un pago en esta cuenta, así que la forma de dividirla queda fija. Para
          corregirla hay que anular el pago primero.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {MODOS.map((m) => (
          <button
            key={m.valor}
            disabled={fijarModo.isPending || e.pagado > 0}
            onClick={() =>
              fijarModo.mutate({
                modo: m.valor,
                n_partes: m.valor === ModoDivision.PARTES_IGUALES ? (e.n_partes ?? 2) : null,
              })
            }
            className={`rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              e.modo === m.valor
                ? 'border-marca bg-marca-claro'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span className="block font-bold">{m.titulo}</span>
            <span className="block text-sm text-slate-600">{m.ayuda}</span>
          </button>
        ))}
      </div>

      {fijarModo.isError && <MensajeError texto={mensajeDeError(fijarModo.error)} />}

      {e.modo === ModoDivision.PARTES_IGUALES && (
        <SelectorPartes
          actual={e.n_partes ?? 2}
          deshabilitado={e.pagado > 0}
          onCambiar={(n) => fijarModo.mutate({ modo: ModoDivision.PARTES_IGUALES, n_partes: n })}
        />
      )}

      {e.modo === ModoDivision.POR_CONSUMO && (
        <PanelPorConsumo
          cuentaId={cuentaId}
          cobro={e}
          deshabilitado={e.pagado > 0}
          onCambio={refrescar}
        />
      )}

      {/* ── Las partes a cobrar ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          {e.modo === ModoDivision.TOTAL ? 'A cobrar' : 'Desglose'}
        </h2>

        {e.modo === ModoDivision.PARTES_IGUALES && (
          <p className="text-sm text-slate-600">
            Los colones que sobran van a la primera parte. El desglose está completo acá abajo para
            que nadie tenga que hacer cuentas mentales.
          </p>
        )}

        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {e.partes.map((parte) => (
            <li key={parte.numero}>
              <div className="tarjeta flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{parte.etiqueta}</p>
                  <p className="text-2xl font-bold tabular-nums">{formatearColones(parte.monto)}</p>
                  {parte.pagado > 0 && parte.saldo > 0 && (
                    <p className="text-sm text-slate-500">
                      pagado {formatearColones(parte.pagado)} · falta{' '}
                      {formatearColones(parte.saldo)}
                    </p>
                  )}
                </div>

                {parte.saldo === 0 && parte.monto > 0 ? (
                  <span className="shrink-0 rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-800">
                    Pagado
                  </span>
                ) : (
                  <button
                    className="boton-primario shrink-0"
                    disabled={!e.se_puede_cobrar || e.saldo === 0}
                    onClick={() => setCobrando(parte)}
                  >
                    Cobrar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {!e.se_puede_cobrar && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            No se puede cobrar todavía: quedan <strong>{e.sin_asignar.length}</strong> línea(s) sin
            asignar. Si se cobra así, esa comida no se le cobra a nadie.
          </p>
        )}

        {e.saldo === 0 && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
            Esta cuenta ya no debe nada.
          </p>
        )}
      </section>

      <ModalPago
        cuentaId={cuentaId}
        parte={cobrando}
        saldoCuenta={e.saldo}
        advertencias={e.advertencias}
        abierto={cobrando !== null}
        onCerrar={() => setCobrando(null)}
        onListo={(nuevo) => {
          refrescar(nuevo);
          setCobrando(null);
          if (nuevo.saldo === 0) navegar(`/caja/cuenta/${cuentaId}`);
        }}
      />
    </div>
  );
}

function SelectorPartes({
  actual,
  deshabilitado,
  onCambiar,
}: {
  actual: number;
  deshabilitado: boolean;
  onCambiar: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-700">¿En cuántas partes?</span>
      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
        <button
          key={n}
          disabled={deshabilitado}
          onClick={() => onCambiar(n)}
          className={`min-h-boton-normal w-12 rounded-lg font-bold tabular-nums disabled:cursor-not-allowed disabled:opacity-60 ${
            n === actual ? 'bg-marca text-white' : 'bg-white ring-1 ring-slate-300'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
