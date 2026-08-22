import {
  COLOR_SIN_MESERA,
  EstadoLinea,
  EventosServidor,
  SalaRealtime,
  type PayloadLineaEstado,
} from '@brisas/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { useSesion } from '../../shared/estado/sesion';
import { useEventoSocket, useSocket } from '../../shared/hooks/useSocket';
import { BannerSinConexion } from '../../shared/ui/BannerSinConexion';
import { PantallaCuenta } from './PantallaCuenta';
import { PantallaCuentas } from './PantallaCuentas';
import { PantallaPedido } from './PantallaPedido';
import { CLAVES_MESERA, useProcesarCola } from './useEnviarPedido';

/** Cuánto se queda en pantalla el aviso de "platillo listo" antes de irse solo. */
const MS_AVISO = 8_000;

interface AvisoPlatillo {
  linea_id: number;
  cuenta_id: number;
  texto: string;
}

/**
 * App de mesera (celular).
 *
 * Todo lo operativo llega por Socket.IO, no por polling: cuando cocina marca
 * LISTO un platillo de SU cuenta, el celular de la mesera se entera solo,
 * vibra y muestra un aviso con qué platillo era y de qué mesa — no tiene que
 * adivinar ni estar mirando la pantalla.
 */
export function MeseraLayout() {
  const usuario = useSesion((s) => s.usuario);
  const cerrar = useSesion((s) => s.cerrar);
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const { socket, conectado } = useSocket(SalaRealtime.MESERAS);
  const { pendientes, reintentar } = useProcesarCola();
  const [avisos, setAvisos] = useState<AvisoPlatillo[]>([]);

  const refrescar = useCallback(() => {
    void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuentas });
    void cliente.invalidateQueries({ queryKey: ['cuentas'] });
  }, [cliente]);

  const quitarAviso = useCallback((linea_id: number) => {
    setAvisos((previos) => previos.filter((a) => a.linea_id !== linea_id));
  }, []);

  useEventoSocket(socket, EventosServidor.CUENTA_ACTUALIZADA, refrescar);
  useEventoSocket(socket, EventosServidor.CUENTA_ABIERTA, refrescar);
  useEventoSocket(socket, EventosServidor.PEDIDO_ESTADO, refrescar);

  useEventoSocket<PayloadLineaEstado>(socket, EventosServidor.LINEA_ESTADO, (payload) => {
    refrescar();

    // Todas las meseras comparten la sala: acá se filtra si el aviso es para
    // ELLA. Nada de secreto — cualquiera puede ver cualquier cuenta — pero
    // vibrarle y mostrarle un aviso de una mesa ajena sería solo ruido.
    if (payload.estado !== EstadoLinea.LISTO) return;
    if (!usuario || payload.mesera_responsable_id !== usuario.id) return;

    const platillo = payload.variante_etiqueta
      ? `${payload.producto_nombre} (${payload.variante_etiqueta})`
      : payload.producto_nombre;
    const texto = `${platillo} listo · ${payload.nombre_cliente}${
      payload.referencia ? ` · ${payload.referencia}` : ''
    }`;

    // El aviso VISIBLE es lo que de verdad importa acá — se muestra primero,
    // pase lo que pase con la vibración. Algunos navegadores bloquean
    // `navigator.vibrate` sin un toque reciente de la usuaria y lo reportan
    // como error: envuelto en try/catch para que eso nunca se lleve puesto
    // el aviso.
    setAvisos((previos) => [
      ...previos,
      { linea_id: payload.linea_id, cuenta_id: payload.cuenta_id, texto },
    ]);
    window.setTimeout(() => quitarAviso(payload.linea_id), MS_AVISO);

    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Sin conexión física de verdad al hardware en algunos navegadores/
      // contextos: el aviso visible ya se mostró, esto es solo un extra.
    }
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

      {/*
        Un platillo suyo está listo. Tocarlo la lleva directo a esa cuenta —
        no tiene que adivinar de qué mesa era. Se apila si llega más de uno.
      */}
      {avisos.length > 0 && (
        <div className="flex flex-col gap-1 bg-green-50 p-2">
          {avisos.map((aviso) => (
            <button
              key={aviso.linea_id}
              onClick={() => {
                quitarAviso(aviso.linea_id);
                navegar(`/mesera/cuenta/${aviso.cuenta_id}`);
              }}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-left text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
            >
              <span aria-hidden>🔔</span>
              <span className="min-w-0 flex-1 truncate">{aviso.texto}</span>
              <span className="shrink-0 font-normal opacity-90">· ver cuenta</span>
            </button>
          ))}
        </div>
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
