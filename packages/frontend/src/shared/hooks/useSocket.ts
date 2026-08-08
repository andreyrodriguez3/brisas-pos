import { EventosCliente, type SalaRealtime } from '@brisas/shared';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

let socketCompartido: Socket | null = null;

/** Un solo socket para toda la app, aunque lo usen varias pantallas. */
function obtenerSocket(): Socket {
  if (!socketCompartido) {
    socketCompartido = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Reconexión agresiva: si el WiFi parpadea, la tablet de cocina debe
      // volver sola, sin que nadie la toque.
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      reconnectionAttempts: Infinity,
    });
  }
  return socketCompartido;
}

export interface UseSocket {
  socket: Socket;
  /** false → la pantalla muestra su aviso de SIN CONEXIÓN. */
  conectado: boolean;
}

/**
 * Conecta a una sala y avisa del estado de la conexión.
 *
 * Ninguna pantalla debe quedarse en blanco al perder la señal: `conectado`
 * existe para mostrar el aviso y mantener en pantalla lo ya recibido.
 */
export function useSocket(sala: SalaRealtime): UseSocket {
  const socket = useRef(obtenerSocket()).current;
  const [conectado, setConectado] = useState(socket.connected);

  useEffect(() => {
    const alConectar = () => {
      setConectado(true);
      socket.emit(EventosCliente.UNIRSE, { sala });
    };
    const alDesconectar = () => setConectado(false);

    socket.on('connect', alConectar);
    socket.on('disconnect', alDesconectar);

    if (socket.connected) alConectar();

    return () => {
      socket.off('connect', alConectar);
      socket.off('disconnect', alDesconectar);
      socket.emit(EventosCliente.SALIR, { sala });
    };
  }, [socket, sala]);

  return { socket, conectado };
}

/** Suscribe un manejador a un evento del servidor mientras el componente viva. */
export function useEventoSocket<T>(
  socket: Socket,
  evento: string,
  manejador: (payload: T) => void,
): void {
  const ref = useRef(manejador);
  ref.current = manejador;

  useEffect(() => {
    const escucha = (payload: T) => ref.current(payload);
    socket.on(evento, escucha);
    return () => {
      socket.off(evento, escucha);
    };
  }, [socket, evento]);
}
