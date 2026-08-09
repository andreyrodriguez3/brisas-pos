import { AccionAuditoria, type AuditoriaConUsuario } from '@brisas/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { Cargando, MensajeError } from '../../shared/ui/Cargando';
import { TEXTO_ACCION } from '../caja/api';
import { mensajeDeError } from './api';

/** Debe coincidir con el `limite` por defecto de `filtroAuditoriaSchema`. */
const REGISTROS_POR_PAGINA = 200;

/**
 * Visor de la bitácora.
 *
 * INVARIANTE 5: `auditoria` es append-only. Esta pantalla solo lee — no hay
 * forma de editar ni de borrar un registro, y no debe haberla: una bitácora que
 * se puede tocar no sirve para resolver una discusión sobre quién hizo qué.
 *
 * La bitácora crece con cada toque de cocina: sin paginación, no habría forma
 * de ver algo de hace tres meses sin adivinar un rango de fechas exacto. Cada
 * página trae hasta `REGISTROS_POR_PAGINA`; "Cargar más" pide los siguientes
 * con `antes_de_id`, el id del último registro ya mostrado.
 */
export function PantallaAuditoria() {
  const [usuarioId, setUsuarioId] = useState<number | ''>('');
  const [accion, setAccion] = useState<string>('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const usuarias = useQuery({ queryKey: ['usuarios', 'todas'], queryFn: () => endpoints.usuarios.listar(true) });

  const registros = useInfiniteQuery({
    queryKey: ['auditoria', 'buscar', usuarioId, accion, desde, hasta],
    queryFn: ({ pageParam }: { pageParam: number | undefined }) =>
      endpoints.auditoria.buscar({
        usuario_id: usuarioId === '' ? undefined : usuarioId,
        accion: accion || undefined,
        desde: desde ? new Date(desde).toISOString() : undefined,
        hasta: hasta ? new Date(hasta).toISOString() : undefined,
        antes_de_id: pageParam,
      }),
    initialPageParam: undefined as number | undefined,
    // Página incompleta: no hay más para traer. Si no, el cursor es el id del
    // último registro (vienen ordenados del más nuevo al más viejo).
    getNextPageParam: (ultimaPagina: AuditoriaConUsuario[]) =>
      ultimaPagina.length < REGISTROS_POR_PAGINA ? undefined : ultimaPagina[ultimaPagina.length - 1]?.id,
  });

  const todos = registros.data?.pages.flat() ?? [];

  const limpiar = () => {
    setUsuarioId('');
    setAccion('');
    setDesde('');
    setHasta('');
  };

  const hayFiltros = usuarioId !== '' || accion !== '' || desde !== '' || hasta !== '';

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <h2 className="text-xl font-bold">Bitácora de auditoría</h2>
        <p className="text-sm text-slate-500">
          Todo lo que pasó, con quién lo hizo y cuándo. Solo se puede leer.
        </p>
      </header>

      <section className="tarjeta flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Usuaria</span>
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value === '' ? '' : Number(e.target.value))}
            className="min-h-boton-normal rounded-lg border border-slate-300 px-3"
          >
            <option value="">Todas</option>
            {usuarias.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Acción</span>
          <select
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            className="min-h-boton-normal rounded-lg border border-slate-300 px-3"
          >
            <option value="">Todas</option>
            {Object.values(AccionAuditoria).map((a) => (
              <option key={a} value={a}>
                {TEXTO_ACCION[a] ?? a}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Desde</span>
          <input
            type="datetime-local"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="min-h-boton-normal rounded-lg border border-slate-300 px-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Hasta</span>
          <input
            type="datetime-local"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="min-h-boton-normal rounded-lg border border-slate-300 px-2"
          />
        </label>

        {hayFiltros && (
          <button className="boton-secundario" onClick={limpiar}>
            Limpiar filtros
          </button>
        )}
      </section>

      {registros.isLoading && <Cargando />}
      {registros.isError && <MensajeError texto={mensajeDeError(registros.error)} />}

      {registros.data && (
        <section className="tarjeta">
          <p className="mb-2 text-sm text-slate-500">{todos.length} registro(s)</p>

          <ol className="flex flex-col divide-y divide-slate-100">
            {todos.map((r) => (
              <li key={r.id} className="flex gap-3 py-2 text-sm">
                <span className="w-32 shrink-0 tabular-nums text-slate-400">
                  {new Date(r.creado_en).toLocaleString('es-CR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span
                  aria-hidden
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: r.usuario_color }}
                />
                <span className="w-24 shrink-0 font-medium">{r.usuario_nombre}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-slate-700">{TEXTO_ACCION[r.accion] ?? r.accion}</span>
                  {r.cuenta_id && <span className="text-slate-400"> · cuenta #{r.cuenta_id}</span>}
                  {r.motivo && <span className="block text-slate-500">« {r.motivo} »</span>}
                </span>
              </li>
            ))}
          </ol>

          {todos.length === 0 && (
            <p className="py-4 text-center text-slate-500">
              No hay registros con esos filtros.
            </p>
          )}

          {registros.hasNextPage && (
            <button
              className="boton-secundario mt-3 w-full"
              disabled={registros.isFetchingNextPage}
              onClick={() => void registros.fetchNextPage()}
            >
              {registros.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
