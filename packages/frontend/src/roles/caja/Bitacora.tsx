import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { mensajeDeError } from '../admin/api';
import { CLAVES_CAJA, TEXTO_ACCION } from './api';

/**
 * La bitácora de una cuenta, desplegable.
 *
 * Es lo que hace posible la edición cruzada: cuando María abre la cuenta de Don
 * Carlos y Ana se la edita, acá queda quién tocó qué y cuándo. Es la respuesta a
 * "¿y esto quién lo cambió?", que es la pregunta que hoy no tiene respuesta.
 *
 * INVARIANTE 5: solo lectura. La tabla es append-only y no tiene —ni va a
 * tener— forma de editarse o borrarse.
 */
export function Bitacora({ cuentaId }: { cuentaId: number }) {
  const [abierta, setAbierta] = useState(false);

  const bitacora = useQuery({
    queryKey: CLAVES_CAJA.bitacora(cuentaId),
    queryFn: () => endpoints.auditoria.deCuenta(cuentaId),
    // No se pide hasta que alguien la despliega: son muchos registros y casi
    // nunca hacen falta.
    enabled: abierta,
  });

  return (
    <section className="tarjeta">
      <button
        onClick={() => setAbierta((a) => !a)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={abierta}
      >
        <span className="font-semibold">Bitácora</span>
        <span className="text-sm text-slate-500">quién tocó qué, y cuándo</span>
        <span className="ml-auto text-slate-400">{abierta ? '▾' : '▸'}</span>
      </button>

      {abierta && (
        <div className="mt-3 border-t pt-3">
          {bitacora.isLoading && <p className="text-sm text-slate-500">Cargando…</p>}
          {bitacora.isError && (
            <p className="text-sm text-red-700">{mensajeDeError(bitacora.error)}</p>
          )}

          <ol className="flex flex-col gap-2">
            {bitacora.data?.map((registro) => (
              <li key={registro.id} className="flex gap-3 text-sm">
                <span
                  aria-hidden
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: registro.usuario_color }}
                />
                <span className="w-16 shrink-0 tabular-nums text-slate-400">
                  {new Date(registro.creado_en).toLocaleTimeString('es-CR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{registro.usuario_nombre}</span>{' '}
                  <span className="text-slate-600">
                    {TEXTO_ACCION[registro.accion] ?? registro.accion}
                  </span>
                  {registro.motivo && (
                    <span className="block text-slate-500">« {registro.motivo} »</span>
                  )}
                  <Cambio antes={registro.antes_json} despues={registro.despues_json} />
                </span>
              </li>
            ))}
          </ol>

          {bitacora.data?.length === 0 && (
            <p className="text-sm text-slate-500">Sin movimientos todavía.</p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * El antes → después, resumido.
 *
 * Se muestran solo los campos que cambiaron: volcar los dos JSON completos
 * llenaría la pantalla de ruido y taparía justo el dato que se está buscando.
 */
function Cambio({ antes, despues }: { antes: string | null; despues: string | null }) {
  const a = interpretar(antes);
  const d = interpretar(despues);
  if (!d) return null;

  const cambios = Object.entries(d)
    .filter(([clave, valor]) => {
      if (typeof valor === 'object') return false;
      return !a || JSON.stringify(a[clave]) !== JSON.stringify(valor);
    })
    .slice(0, 4);

  if (cambios.length === 0) return null;

  return (
    <span className="block text-xs text-slate-500">
      {cambios.map(([clave, valor]) => (
        <span key={clave} className="mr-3 inline-block">
          {clave}: {a && a[clave] !== undefined && <s className="text-slate-400">{String(a[clave])}</s>}{' '}
          <span className="font-medium text-slate-700">{String(valor)}</span>
        </span>
      ))}
    </span>
  );
}

function interpretar(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const valor: unknown = JSON.parse(json);
    return valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
