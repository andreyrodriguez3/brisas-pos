import { EventosCliente, type SalaRealtime } from '@brisas/shared';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSesion } from '../estado/sesion';

let socketCompartido: Socket | null = null;

/**
 * Un solo socket para toda la app, aunque lo usen varias pantallas.
 *
 * Pide el mismo JWT que ya usa el REST — `auth` como función, no como objeto
 * fijo, para que se reevalúe en cada intento de conexión/reconexión sin
 * plumbing extra. Sin token válido, el servidor cierra la conexión sola (ver
 * `RealtimeGateway.handleConnection`).
 */
function obtenerSocket(): Socket {
  if (!socketCompartido) {
    socketCompartido = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: useSesion.getState().token }),
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

// Si cambia el token (login, logout, o cambio de usuaria en la misma pestaña),
// se rehace el handshake para que la sala a la que se une coincida con el rol
// de la sesión actual — sin esto, el socket seguiría conectado con la
// identidad de la persona anterior hasta el próximo parpadeo de WiFi.
useSesion.subscribe((estado, anterior) => {
  if (estado.token !== anterior.token && socketCompartido) {
    socketCompartido.disconnect();
    socketCompartido.connect();
  }
});

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
