import {
  COLOR_SIN_MESERA,
  formatearColones,
  type CuentaResumen,
  type EstadoPedido,
} from '@brisas/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../../shared/api/endpoints';
import { useSesion } from '../../shared/estado/sesion';
import { Cargando, MensajeError, Vacio } from '../../shared/ui/Cargando';
import { Insignia } from '../../shared/ui/Insignia';
import { mensajeDeError } from '../admin/api';
import { AvisoCuentaAjena } from './AvisoCuentaAjena';
import { FormularioCuenta } from './FormularioCuenta';
import { CLAVES_MESERA } from './useEnviarPedido';

const ESTADO_COCINA: Record<EstadoPedido, { texto: string; tono: 'aviso' | 'info' | 'ok' | 'neutro' }> = {
  ENVIADO: { texto: 'En cola', tono: 'aviso' },
  EN_PREPARACION: { texto: 'Preparando', tono: 'info' },
  LISTO: { texto: '¡Listo!', tono: 'ok' },
  ENTREGADO: { texto: 'Entregado', tono: 'neutro' },
};

/**
 * Lista de cuentas abiertas.
 *
 * Las propias van arriba y a todo color; las de las compañeras abajo, apagadas
 * pero perfectamente accesibles — la edición cruzada es un requisito, no una
 * excepción. Lo que separa a una de otra es un aviso, no un candado.
 */
export function PantallaCuentas() {
  const usuario = useSesion((s) => s.usuario);
  const navegar = useNavigate();
  const [creando, setCreando] = useState(false);
  const [ajena, setAjena] = useState<CuentaResumen | null>(null);

  const cuentas = useQuery({
    queryKey: CLAVES_MESERA.cuentas,
    queryFn: endpoints.cuentas.listar,
    // Los datos llegan por Socket.IO; esto es solo el respaldo.
    refetchInterval: 60_000,
  });

  if (cuentas.isLoading) return <Cargando texto="Buscando las cuentas…" />;
  if (cuentas.isError) return <MensajeError texto={mensajeDeError(cuentas.error)} />;

  const lista = cuentas.data ?? [];
  const propias = lista.filter((c) => c.mesera_responsable_id === usuario?.id);
  const ajenas = lista.filter((c) => c.mesera_responsable_id !== usuario?.id);

  function abrir(cuenta: CuentaResumen) {
    // Al tocar una cuenta que no es suya: aviso claro, no un obstáculo.
    if (cuenta.mesera_responsable_id !== usuario?.id && cuenta.mesera_nombre) {
      setAjena(cuenta);
      return;
    }
    navegar(`/mesera/cuenta/${cuenta.id}`);
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pb-24">
        {lista.length === 0 && (
          <Vacio
            titulo="No hay cuentas abiertas"
            detalle="Tocá el botón de abajo para abrir la primera."
          />
        )}

        {propias.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Tus cuentas
            </h2>
            {propias.map((c) => (
              <TarjetaCuenta key={c.id} cuenta={c} onAbrir={() => abrir(c)} />
            ))}
          </section>
        )}

        {ajenas.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              De las compañeras
            </h2>
            {/* Apagadas pero accesibles: cualquiera puede editarlas. */}
            {ajenas.map((c) => (
              <TarjetaCuenta key={c.id} cuenta={c} apagada onAbrir={() => abrir(c)} />
            ))}
          </section>
        )}
      </div>

      {/* Botón flotante grande, siempre a mano. */}
      <div className="pointer-events-none sticky bottom-0 flex justify-center p-4">
        <button
          className="boton-primario pointer-events-auto min-h-tactil w-full max-w-sm text-lg shadow-lg"
          onClick={() => setCreando(true)}
        >
          + Nueva cuenta
        </button>
      </div>

      {creando && <FormularioCuenta onCerrar={() => setCreando(false)} />}

      {ajena && (
        <AvisoCuentaAjena
          nombreMesera={ajena.mesera_nombre ?? 'otra mesera'}
          onCancelar={() => setAjena(null)}
          onContinuar={() => {
            const id = ajena.id;
            setAjena(null);
            navegar(`/mesera/cuenta/${id}`);
          }}
        />
      )}
    </>
  );
}

function TarjetaCuenta({
  cuenta,
  apagada,
  onAbrir,
}: {
  cuenta: CuentaResumen;
  apagada?: boolean;
  onAbrir: () => void;
}) {
  const color = cuenta.mesera_color || COLOR_SIN_MESERA;
  const estado = cuenta.estado_cocina ? ESTADO_COCINA[cuenta.estado_cocina] : null;
  const minutos = Math.floor((Date.now() - new Date(cuenta.abierta_en).getTime()) / 60_000);

  return (
    <button
      onClick={onAbrir}
      className={`tarjeta-mesera w-full text-left transition active:scale-[0.99] ${
        apagada ? 'tarjeta-ajena' : ''
      }`}
      style={{ borderLeftColor: color, backgroundColor: apagada ? undefined : `${color}0F` }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{cuenta.nombre_cliente}</h3>
          <p className="truncate text-sm text-slate-600">
            {/* El color NUNCA va solo: siempre con el nombre en texto legible. */}
            {cuenta.mesera_nombre ?? 'Sin mesera'}
            {cuenta.referencia && ` · ${cuenta.referencia}`}
          </p>
        </div>
        <span className="shrink-0 text-lg font-bold tabular-nums">
          {formatearColones(cuenta.total)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {cuenta.canal === 'PARA_LLEVAR' && <Insignia tono="info">Para llevar</Insignia>}
        {estado && <Insignia tono={estado.tono}>{estado.texto}</Insignia>}
        {cuenta.n_pedidos > 1 && <Insignia>{cuenta.n_pedidos} pedidos</Insignia>}
        {cuenta.editada_por_terceros && <Insignia tono="aviso">Editada por otra</Insignia>}
        <span className="ml-auto text-xs text-slate-400">
          hace {minutos < 1 ? 'un momento' : `${minutos} min`}
        </span>
      </div>
    </button>
  );
}
