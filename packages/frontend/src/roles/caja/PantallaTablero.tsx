import {
  COLOR_SIN_MESERA,
  CanalCuenta,
  EstadoCuenta,
  formatearColones,
  type CuentaResumen,
} from '@brisas/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../../shared/api/endpoints';
import { Cargando, MensajeError, Vacio } from '../../shared/ui/Cargando';
import { Insignia } from '../../shared/ui/Insignia';
import { mensajeDeError } from '../admin/api';
import { CLAVES_CAJA } from './api';

const FILTROS = [
  { clave: 'TODAS', etiqueta: 'Todas' },
  { clave: CanalCuenta.SALON, etiqueta: 'Salón' },
  { clave: CanalCuenta.PARA_LLEVAR, etiqueta: 'Para llevar' },
] as const;

const ESTADO_COCINA: Record<string, { texto: string; tono: 'aviso' | 'info' | 'ok' | 'neutro' }> = {
  ENVIADO: { texto: 'En cola', tono: 'aviso' },
  EN_PREPARACION: { texto: 'Preparando', tono: 'info' },
  LISTO: { texto: 'Listo', tono: 'ok' },
  ENTREGADO: { texto: 'Entregado', tono: 'neutro' },
};

/**
 * Tablero de caja: todas las cuentas en juego, en cuadrícula.
 *
 * Coloreadas por mesera —siempre junto a su nombre en texto, nunca solo el
 * color— con filtro por canal y buscador por nombre del cliente. El restaurante
 * no usa números de mesa: buscar por nombre es la forma de encontrar una cuenta.
 */
export function PantallaTablero() {
  const navegar = useNavigate();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['clave']>('TODAS');
  const [busqueda, setBusqueda] = useState('');

  const cuentas = useQuery({
    queryKey: CLAVES_CAJA.cuentas,
    queryFn: () => endpoints.cuentas.listar(),
  });

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (cuentas.data ?? [])
      .filter((c) => filtro === 'TODAS' || c.canal === filtro)
      .filter(
        (c) =>
          texto === '' ||
          c.nombre_cliente.toLowerCase().includes(texto) ||
          (c.referencia ?? '').toLowerCase().includes(texto) ||
          (c.mesera_nombre ?? '').toLowerCase().includes(texto),
      );
  }, [cuentas.data, filtro, busqueda]);

  if (cuentas.isLoading) return <Cargando texto="Cargando las cuentas…" />;
  if (cuentas.isError) return <MensajeError texto={mensajeDeError(cuentas.error)} />;

  const totalEnJuego = visibles.reduce((acc, c) => acc + c.total, 0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {FILTROS.map((f) => (
            <button
              key={f.clave}
              onClick={() => setFiltro(f.clave)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                filtro === f.clave ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente, referencia o mesera…"
          className="min-h-boton-normal flex-1 rounded-lg border border-slate-300 px-3 text-sm"
        />

        <p className="text-sm text-slate-600">
          {visibles.length} {visibles.length === 1 ? 'cuenta' : 'cuentas'} ·{' '}
          <span className="font-semibold tabular-nums">{formatearColones(totalEnJuego)}</span>
        </p>
      </div>

      {visibles.length === 0 ? (
        <Vacio
          titulo="No hay cuentas"
          detalle={
            busqueda || filtro !== 'TODAS'
              ? 'Probá quitando el filtro o el buscador.'
              : 'Cuando una mesera abra una cuenta, aparece acá sola.'
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visibles.map((cuenta) => (
            <li key={cuenta.id}>
              <TarjetaCuenta cuenta={cuenta} onAbrir={() => navegar(`/caja/cuenta/${cuenta.id}`)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaCuenta({ cuenta, onAbrir }: { cuenta: CuentaResumen; onAbrir: () => void }) {
  const color = cuenta.mesera_color ?? COLOR_SIN_MESERA;
  const estado = cuenta.estado_cocina ? ESTADO_COCINA[cuenta.estado_cocina] : null;

  return (
    <button
      onClick={onAbrir}
      style={{ borderLeftColor: color }}
      className="tarjeta-mesera w-full text-left transition hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{cuenta.nombre_cliente}</p>
          <p className="truncate text-sm text-slate-500">
            {/* El color NUNCA es la única señal: el nombre va siempre en texto. */}
            {cuenta.mesera_nombre ?? 'Sin mesera'}
            {cuenta.referencia && ` · ${cuenta.referencia}`}
          </p>
        </div>
        <span className="shrink-0 text-lg font-bold tabular-nums">
          {formatearColones(cuenta.total)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {cuenta.canal === CanalCuenta.PARA_LLEVAR && <Insignia tono="info">Para llevar</Insignia>}
        {cuenta.estado === EstadoCuenta.EN_COBRO && <Insignia tono="aviso">En cobro</Insignia>}
        {estado && <Insignia tono={estado.tono}>{estado.texto}</Insignia>}
        {cuenta.editada_por_terceros && <Insignia>Editada por otra</Insignia>}
        <span className="ml-auto text-xs text-slate-400">
          {new Date(cuenta.abierta_en).toLocaleTimeString('es-CR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </button>
  );
}
