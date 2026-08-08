import { formatearColones } from '@brisas/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { Cargando, MensajeError } from '../../shared/ui/Cargando';
import { mensajeDeError } from './api';

/** YYYY-MM-DD de hoy, en hora local. Es la clave de día que usa el turno. */
function hoy(): string {
  const t = new Date();
  return new Date(t.getTime() - t.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function haceDias(n: number): string {
  const t = new Date(Date.now() - n * 86_400_000);
  return new Date(t.getTime() - t.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const RANGOS = [
  { etiqueta: 'Hoy', desde: hoy(), hasta: hoy() },
  { etiqueta: 'Últimos 7 días', desde: haceDias(6), hasta: hoy() },
  { etiqueta: 'Últimos 30 días', desde: haceDias(29), hasta: hoy() },
] as const;

/**
 * Reportes de la dueña.
 *
 * Todo sale de las cuentas ya cobradas y respeta la separación por canal: salón,
 * para llevar y envases son tres bolsas independientes, y ninguna línea de
 * comida cambia de bolsa.
 */
export function PantallaReportes() {
  const [desde, setDesde] = useState(RANGOS[1].desde);
  const [hasta, setHasta] = useState(RANGOS[1].hasta);

  const reporte = useQuery({
    queryKey: ['reportes', 'ventas', desde, hasta],
    queryFn: () => endpoints.reportes.ventas(desde, hasta),
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex flex-wrap items-end gap-3">
        <h2 className="text-xl font-bold">Reportes</h2>

        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {RANGOS.map((r) => (
            <button
              key={r.etiqueta}
              onClick={() => {
                setDesde(r.desde);
                setHasta(r.hasta);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                desde === r.desde && hasta === r.hasta
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Del</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="min-h-boton-normal rounded-lg border border-slate-300 px-2"
          />
          <span className="text-slate-600">al</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="min-h-boton-normal rounded-lg border border-slate-300 px-2"
          />
        </label>
      </header>

      {reporte.isLoading && <Cargando />}
      {reporte.isError && <MensajeError texto={mensajeDeError(reporte.error)} />}

      {reporte.data && (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            <Tarjeta
              titulo="Salón"
              monto={reporte.data.totalizadores.salon}
              detalle="atribuible a las meseras"
            />
            <Tarjeta
              titulo="Para llevar"
              monto={reporte.data.totalizadores.para_llevar}
              detalle="cuenta aparte"
            />
            <Tarjeta
              titulo="Envases"
              monto={reporte.data.totalizadores.envases}
              detalle="recuperación de empaque"
            />
            <Tarjeta
              titulo="Descuentos"
              monto={reporte.data.total_descuentos}
              detalle="y cortesías"
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel titulo="Por día">
              <Tabla
                columnas={['Día', 'Salón', 'Para llevar', 'Envases', 'Cuentas']}
                filas={reporte.data.por_dia.map((d) => [
                  d.dia,
                  formatearColones(d.salon),
                  formatearColones(d.para_llevar),
                  formatearColones(d.envases),
                  String(d.n_cuentas),
                ])}
              />
            </Panel>

            <Panel titulo="Por mesera" ayuda="Solo ventas de salón: es lo atribuible.">
              {reporte.data.por_mesera.length === 0 ? (
                <p className="text-sm text-slate-500">Sin ventas atribuidas en el rango.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {reporte.data.por_mesera.map((m) => (
                    <li key={m.usuario_id} className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: m.color_hex }}
                      />
                      <span className="flex-1 font-medium">{m.nombre}</span>
                      <span className="text-sm text-slate-500">{m.n_cuentas} cuentas</span>
                      <span className="font-semibold tabular-nums">
                        {formatearColones(m.ventas)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel titulo="Por platillo" ayuda="Qué se vende de verdad.">
              <Tabla
                columnas={['Platillo', 'Categoría', 'Unidades', 'Monto']}
                filas={reporte.data.por_platillo
                  .slice(0, 25)
                  .map((p) => [
                    p.nombre,
                    p.categoria,
                    String(p.unidades),
                    formatearColones(p.monto),
                  ])}
              />
            </Panel>

            <Panel titulo="Por forma de pago" ayuda="Informativa: el sistema no procesa cobros.">
              {reporte.data.formas_pago.length === 0 ? (
                <p className="text-sm text-slate-500">Sin pagos registrados en el rango.</p>
              ) : (
                <Tabla
                  columnas={['Forma', 'Pagos', 'Monto']}
                  filas={reporte.data.formas_pago.map((f) => [
                    f.forma_pago,
                    String(f.n_pagos),
                    formatearColones(f.monto),
                  ])}
                />
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Tarjeta({ titulo, monto, detalle }: { titulo: string; monto: number; detalle: string }) {
  return (
    <div className="tarjeta">
      <p className="text-sm font-medium text-slate-600">{titulo}</p>
      <p className="text-2xl font-bold tabular-nums">{formatearColones(monto)}</p>
      <p className="text-xs text-slate-400">{detalle}</p>
    </div>
  );
}

function Panel({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tarjeta">
      <h3 className="font-semibold">{titulo}</h3>
      {ayuda && <p className="mb-2 text-sm text-slate-500">{ayuda}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  if (filas.length === 0) {
    return <p className="text-sm text-slate-500">Sin datos en el rango.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-600">
            {columnas.map((c, i) => (
              <th key={c} className={`py-1.5 pr-3 ${i > 0 ? 'text-right' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-b last:border-0">
              {fila.map((celda, j) => (
                <td
                  key={j}
                  className={`py-1.5 pr-3 ${j > 0 ? 'text-right tabular-nums' : 'font-medium'}`}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
