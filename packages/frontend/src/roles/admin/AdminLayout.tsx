import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Route, Routes } from 'react-router-dom';
import { endpoints } from '../../shared/api/endpoints';
import { useSesion } from '../../shared/estado/sesion';
import { Cargando, Vacio } from '../../shared/ui/Cargando';
import { CLAVES, mensajeDeError } from './api';
import { PantallaAuditoria } from './PantallaAuditoria';
import { PantallaReportes } from './PantallaReportes';
import { PantallaGruposOpcion } from './menu/PantallaGruposOpcion';
import { PantallaMenu } from './menu/PantallaMenu';
import { PantallaUsuarias } from './usuarias/PantallaUsuarias';

const SECCIONES = [
  { a: '', titulo: 'Menú' },
  { a: 'opciones', titulo: 'Opciones' },
  { a: 'usuarias', titulo: 'Usuarias' },
  { a: 'reportes', titulo: 'Reportes' },
  { a: 'auditoria', titulo: 'Auditoría' },
  { a: 'configuracion', titulo: 'Configuración' },
] as const;

/** Panel de administración (la dueña). */
export function AdminLayout() {
  const usuario = useSesion((s) => s.usuario);
  const cerrar = useSesion((s) => s.cerrar);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-marca">Administración</h1>
        <nav className="flex flex-1 flex-wrap gap-1">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.a}
              to={s.a}
              end={s.a === ''}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-marca-claro text-marca-oscuro' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {s.titulo}
            </NavLink>
          ))}
        </nav>
        <span className="text-sm text-slate-500">{usuario?.nombre}</span>
        <button className="boton-secundario text-sm" onClick={cerrar}>
          Salir
        </button>
      </header>

      <main className="flex flex-1 flex-col">
        <Routes>
          <Route index element={<PantallaMenu />} />
          <Route path="opciones" element={<PantallaGruposOpcion />} />
          <Route path="usuarias" element={<PantallaUsuarias />} />
          <Route path="reportes" element={<PantallaReportes />} />
          <Route path="auditoria" element={<PantallaAuditoria />} />
          <Route path="configuracion" element={<PantallaConfiguracion />} />
        </Routes>
      </main>
    </div>
  );
}

/** Qué controla cada clave, en español, para que la dueña sepa qué está tocando. */
const QUE_HACE: Record<string, string> = {
  REGLA_REPARTO:
    'Cuál de los tres repartos manda. El cierre igual muestra los tres, así que se puede cambiar viendo números reales.',
  PRECIO_ENVASE: 'Colones por envase. Las cuentas ya abiertas no cambian.',
  MIN_ALERTA_COCINA: 'Minutos para que la comanda se ponga naranja en cocina.',
  MIN_URGENTE_COCINA: 'Minutos para que se ponga roja.',
  PRECIOS_INCLUYEN_IMPUESTOS:
    'Los precios del menú ya traen IVA y servicio. Hoy el sistema no calcula impuestos.',
};

const OPCIONES: Record<string, string[]> = {
  REGLA_REPARTO: ['ATRIBUCION', 'HORAS', 'PARTES_IGUALES'],
  PRECIOS_INCLUYEN_IMPUESTOS: ['true', 'false'],
};

function PantallaConfiguracion() {
  const cliente = useQueryClient();
  const config = useQuery({
    queryKey: CLAVES.configuracion,
    queryFn: endpoints.configuracion.todas,
  });

  const guardar = useMutation({
    mutationFn: ({ clave, valor }: { clave: string; valor: string }) =>
      endpoints.configuracion.establecer(clave, valor),
    onSuccess: () => cliente.invalidateQueries({ queryKey: CLAVES.configuracion }),
  });

  if (config.isLoading) return <Cargando />;
  if (config.isError) return <Vacio titulo="No se pudo cargar la configuración" />;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">Configuración</h2>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Se ajustan sin tocar código y el cambio es inmediato. Cambiar un precio{' '}
        <strong>no</strong> afecta las cuentas ya abiertas: los precios se congelan al mandar el
        pedido.
      </p>

      <dl className="max-w-2xl space-y-2">
        {Object.entries(config.data ?? {}).map(([clave, valor]) => (
          <div key={clave} className="tarjeta">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <dt className="font-mono text-sm">{clave}</dt>
              <dd>
                {OPCIONES[clave] ? (
                  <select
                    value={valor}
                    disabled={guardar.isPending}
                    onChange={(e) => guardar.mutate({ clave, valor: e.target.value })}
                    className="min-h-boton-normal rounded-lg border border-slate-300 px-3 font-semibold"
                  >
                    {OPCIONES[clave].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    defaultValue={valor}
                    inputMode="numeric"
                    disabled={guardar.isPending}
                    onBlur={(e) => {
                      const nuevo = e.target.value.trim();
                      if (nuevo && nuevo !== valor) guardar.mutate({ clave, valor: nuevo });
                    }}
                    className="min-h-boton-normal w-32 rounded-lg border border-slate-300 px-3 text-right font-semibold tabular-nums"
                  />
                )}
              </dd>
            </div>
            {QUE_HACE[clave] && (
              <p className="mt-1 text-sm text-slate-500">{QUE_HACE[clave]}</p>
            )}
          </div>
        ))}
      </dl>

      {guardar.isError && (
        <p className="mt-3 text-sm text-red-700">{mensajeDeError(guardar.error)}</p>
      )}
    </div>
  );
}
