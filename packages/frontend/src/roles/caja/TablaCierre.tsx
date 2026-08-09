import { formatearColones, type CierreCompleto, type ReglaReparto } from '@brisas/shared';

/** Cómo se llama cada regla en la pantalla. */
export const NOMBRE_REGLA: Record<ReglaReparto, string> = {
  ATRIBUCION: 'Por atribución',
  HORAS: 'Por horas',
  PARTES_IGUALES: 'Partes iguales',
};

const AYUDA_REGLA: Record<ReglaReparto, string> = {
  ATRIBUCION: 'cada una se lleva lo de sus propias cuentas',
  HORAS: 'proporcional a las horas trabajadas',
  PARTES_IGUALES: 'el total dividido entre todas',
};

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * El cierre del día, completo.
 *
 * Muestra **las tres reglas de reparto lado a lado**, no solo la que está
 * activa. La dueña todavía no decidió cuál usar cuando hay dos o más meseras al
 * mismo tiempo, y esa decisión se toma mejor viendo números reales que en
 * abstracto. La columna de la regla activa va resaltada.
 *
 * El sistema calcula y muestra: la entrega del dinero la hace la caja a mano.
 */
export function TablaCierre({ cierre }: { cierre: CierreCompleto }) {
  return (
    <div className="flex flex-col gap-5">
      {/* ── Las tres bolsas ────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-2 font-semibold">Lo que entró</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <Bolsa titulo="Salón" monto={cierre.total_salon} detalle="atribuible a las meseras" />
          <Bolsa
            titulo="Para llevar"
            monto={cierre.total_para_llevar}
            detalle="cuenta aparte de la dueña"
          />
          <Bolsa titulo="Envases" monto={cierre.total_envases} detalle="recuperación de empaque" />
        </div>

        <dl className="mt-2 flex flex-col gap-1 text-sm">
          <Linea etiqueta="Descuentos y cortesías" monto={-cierre.total_descuentos} />
          <div className="flex justify-between border-t pt-1 font-semibold">
            <dt>Total cobrado</dt>
            <dd className="tabular-nums">{formatearColones(cierre.total_cobrado)}</dd>
          </div>
          <p className="text-xs text-slate-500">
            {cierre.n_cuentas} cuenta(s) cobradas · {cierre.n_pedidos} comanda(s)
          </p>
        </dl>
      </section>

      {/* ── Los tres repartos ──────────────────────────────────────────────── */}
      <section>
        <h3 className="font-semibold">Reparto entre meseras</h3>
        <p className="mb-2 text-sm text-slate-600">
          Se reparte el <strong>{cierre.porcentaje_propina}%</strong> de servicio sobre el total de{' '}
          <strong>salón</strong>: {formatearColones(cierre.base_reparto)} de{' '}
          {formatearColones(cierre.total_salon)}. Para llevar es la cuenta aparte de la dueña y los
          envases son empaque, no venta de nadie. Hoy manda{' '}
          <strong>{NOMBRE_REGLA[cierre.regla_aplicada]}</strong> — {AYUDA_REGLA[cierre.regla_aplicada]}.
        </p>

        {cierre.meseras.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            No hay meseras marcadas en el turno, así que no hay nada que repartir. Las horas se
            marcan en la pantalla de turno.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="py-2 pr-3">Mesera</th>
                  <th className="py-2 pr-3">Entrada → salida</th>
                  <th className="py-2 pr-3 text-right">Horas</th>
                  <th className="py-2 pr-3 text-right">Vendió</th>
                  {(['ATRIBUCION', 'HORAS', 'PARTES_IGUALES'] as ReglaReparto[]).map((regla) => (
                    <th
                      key={regla}
                      className={`py-2 pr-3 text-right ${
                        regla === cierre.regla_aplicada ? 'bg-marca-claro text-marca-oscuro' : ''
                      }`}
                    >
                      {NOMBRE_REGLA[regla]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cierre.meseras.map((m) => (
                  <tr key={m.usuario_id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: m.color_hex }}
                        />
                        {/* El color nunca va solo: el nombre siempre en texto. */}
                        <span className="font-medium">{m.nombre}</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {hora(m.hora_entrada)} → {hora(m.hora_salida)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {m.horas_trabajadas.toFixed(2)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatearColones(m.ventas_atribuidas)}
                    </td>
                    <Celda monto={m.monto_atribucion} activa={cierre.regla_aplicada === 'ATRIBUCION'} />
                    <Celda monto={m.monto_horas} activa={cierre.regla_aplicada === 'HORAS'} />
                    <Celda
                      monto={m.monto_partes_iguales}
                      activa={cierre.regla_aplicada === 'PARTES_IGUALES'}
                    />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2 pr-3" colSpan={4}>
                    Total
                  </td>
                  {(
                    [
                      cierre.meseras.reduce((a, m) => a + m.monto_atribucion, 0),
                      cierre.meseras.reduce((a, m) => a + m.monto_horas, 0),
                      cierre.meseras.reduce((a, m) => a + m.monto_partes_iguales, 0),
                    ] as const
                  ).map((total, i) => (
                    <td key={i} className="py-2 pr-3 text-right tabular-nums">
                      {formatearColones(total)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="mt-2 text-xs text-slate-500">
          El sistema calcula y muestra. La entrega del dinero la hace la caja a mano.
        </p>
      </section>

      {/* ── Formas de pago ─────────────────────────────────────────────────── */}
      {cierre.formas_pago.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Por forma de pago</h3>
          <p className="mb-2 text-sm text-slate-600">Para cuadrar la caja física.</p>
          <dl className="flex flex-col gap-1 text-sm">
            {cierre.formas_pago.map((f) => (
              <div key={f.forma_pago} className="flex justify-between gap-3">
                <dt className="text-slate-600">
                  {f.forma_pago} <span className="text-slate-400">({f.n_pagos})</span>
                </dt>
                <dd className="font-semibold tabular-nums">{formatearColones(f.monto)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ── Anuladas ───────────────────────────────────────────────────────── */}
      {cierre.cuentas_anuladas.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Cuentas anuladas</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {cierre.cuentas_anuladas.map((c) => (
              <li key={c.id} className="rounded-lg bg-slate-50 p-2">
                <span className="font-medium">{c.nombre_cliente}</span>
                <span className="text-slate-500"> — anulada por {c.anulada_por}</span>
                {c.motivo && <span className="block text-slate-500">« {c.motivo} »</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Bolsa({ titulo, monto, detalle }: { titulo: string; monto: number; detalle: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-600">{titulo}</p>
      <p className="text-xl font-bold tabular-nums">{formatearColones(monto)}</p>
      <p className="text-xs text-slate-400">{detalle}</p>
    </div>
  );
}

function Linea({ etiqueta, monto }: { etiqueta: string; monto: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-600">{etiqueta}</dt>
      <dd className="tabular-nums">
        {monto < 0 ? `−${formatearColones(-monto)}` : formatearColones(monto)}
      </dd>
    </div>
  );
}

function Celda({ monto, activa }: { monto: number; activa: boolean }) {
  return (
    <td
      className={`py-2 pr-3 text-right tabular-nums ${
        activa ? 'bg-marca-claro font-bold text-marca-oscuro' : 'text-slate-500'
      }`}
    >
      {formatearColones(monto)}
    </td>
  );
}
