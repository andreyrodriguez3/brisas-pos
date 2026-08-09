import { COLOR_SIN_MESERA, EventosServidor, SalaRealtime, type PayloadPedidoEstado } from '@brisas/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { useSesion } from '../../shared/estado/sesion';
import { useEventoSocket, useSocket } from '../../shared/hooks/useSocket';
import { BannerSinConexion } from '../../shared/ui/BannerSinConexion';
import { PantallaCuenta } from './PantallaCuenta';
import { PantallaCuentas } from './PantallaCuentas';
import { PantallaPedido } from './PantallaPedido';
import { CLAVES_MESERA, useProcesarCola } from './useEnviarPedido';

/**
 * App de mesera (celular).
 *
 * Todo lo operativo llega por Socket.IO, no por polling: cuando cocina marca un
 * pedido como LISTO, el celular de la mesera se entera solo y vibra.
 */
export function MeseraLayout() {
  const usuario = useSesion((s) => s.usuario);
  const cerrar = useSesion((s) => s.cerrar);
  const cliente = useQueryClient();
  const { socket, conectado } = useSocket(SalaRealtime.MESERAS);
  const { pendientes, reintentar } = useProcesarCola();

  const refrescar = () => {
    void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuentas });
    void cliente.invalidateQueries({ queryKey: ['cuentas'] });
  };

  useEventoSocket(socket, EventosServidor.CUENTA_ACTUALIZADA, refrescar);
  useEventoSocket(socket, EventosServidor.CUENTA_ABIERTA, refrescar);

  useEventoSocket<PayloadPedidoEstado>(socket, EventosServidor.PEDIDO_ESTADO, (payload) => {
    refrescar();
    // Cuando algo pasa a LISTO el celular vibra: la mesera no tiene que estar
    // mirando la pantalla para enterarse de que hay comida esperando.
    if (payload.estado === 'LISTO') navigator.vibrate?.([200, 100, 200]);
  });

  const color = usuario?.color_hex || COLOR_SIN_MESERA;

  return (
    <div className="flex min-h-dvh flex-col">
      <BannerSinConexion conectado={conectado} />

      {/*
        Indicador de la cola offline. La mesera tiene que poder ver de un vistazo
        que un pedido todavía no salió — es lo que la deja seguir trabajando
        tranquila en la zona sin señal.
      */}
      {pendientes.length > 0 && (
        <button
          onClick={() => void reintentar()}
          className="flex w-full items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-sm font-semibold text-white"
        >
          <span aria-hidden>⏳</span>
          {pendientes.length} pedido{pendientes.length === 1 ? '' : 's'} pendiente
          {pendientes.length === 1 ? '' : 's'} de enviar
          <span className="font-normal opacity-90">· tocá para reintentar</span>
        </button>
      )}

      <header
        className="flex items-center gap-3 border-b-4 bg-white px-4 py-3 shadow-sm"
        style={{ borderBottomColor: color }}
      >
        <span
          aria-hidden
          className="h-9 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1">
          {/* El color va siempre acompañado del nombre en texto legible. */}
          <p className="font-semibold leading-tight">{usuario?.nombre}</p>
          <p className="text-xs text-slate-500">Mesera</p>
        </div>
        <button className="boton-secundario text-sm" onClick={cerrar}>
          Salir
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <Routes>
          <Route index element={<PantallaCuentas />} />
          <Route path="cuenta/:id" element={<PantallaCuenta />} />
          <Route path="cuenta/:id/pedido" element={<PantallaPedido />} />
        </Routes>
      </main>
    </div>
  );
}
