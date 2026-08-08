import type { LineaNuevaDto } from '@brisas/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApi } from '../../shared/api/cliente';
import { endpoints } from '../../shared/api/endpoints';
import { useColaOffline, type PedidoPendiente } from './estado/colaOffline';

export const CLAVES_MESERA = {
  cuentas: ['cuentas'] as const,
  cuenta: (id: number) => ['cuentas', id] as const,
  menu: ['menu'] as const,
};

interface Enviar {
  cuenta_id: number;
  cuenta_nombre: string;
  lineas: LineaNuevaDto[];
}

/**
 * Manda un pedido a cocina, con la cola offline detrás.
 *
 * El orden importa: el pedido se ENCOLA primero y se manda después. Si el
 * celular se queda sin señal justo en el medio —o se apaga— el pedido ya está
 * guardado y sale solo cuando vuelva la conexión.
 *
 * Un error de red deja el pedido en la cola para reintentar. Un error de
 * validación (el producto se agotó, la cuenta ya se está cobrando) lo saca: por
 * más que se reintente va a fallar igual, y dejarlo ahí haría que la mesera vea
 * un "pendiente" que nunca se va.
 */
export function useEnviarPedido() {
  const cliente = useQueryClient();
  const { encolar, quitar, marcarIntentoFallido } = useColaOffline();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(
    (cuentaId: number) => {
      void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuentas });
      void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuenta(cuentaId) });
    },
    [cliente],
  );

  const enviar = useCallback(
    async ({ cuenta_id, cuenta_nombre, lineas }: Enviar): Promise<'enviado' | 'encolado'> => {
      const idempotencia_key = crypto.randomUUID();
      setError(null);
      setEnviando(true);

      // Primero se guarda, después se manda. Nunca al revés.
      encolar({ idempotencia_key, cuenta_id, cuenta_nombre, lineas });

      try {
        await endpoints.pedidos.enviar({ cuenta_id, lineas, idempotencia_key });
        quitar(idempotencia_key);
        refrescar(cuenta_id);
        return 'enviado';
      } catch (e) {
        if (e instanceof ErrorApi && !e.esDeConexion) {
          // El servidor lo rechazó por una razón que no se arregla reintentando.
          quitar(idempotencia_key);
          setError(e.message);
          throw e;
        }
        marcarIntentoFallido(idempotencia_key, 'Sin conexión');
        return 'encolado';
      } finally {
        setEnviando(false);
      }
    },
    [encolar, quitar, marcarIntentoFallido, refrescar],
  );

  return { enviar, enviando, error, limpiarError: () => setError(null) };
}

/**
 * Vacía la cola en cuanto haya señal.
 *
 * Se dispara al montar, cuando el navegador avisa que volvió la conexión, y
 * cada 15 segundos mientras quede algo pendiente. El candado evita que dos
 * disparos a la vez manden el mismo pedido dos veces — aunque si pasara, la
 * clave de idempotencia lo atajaría igual en el servidor.
 */
export function useProcesarCola() {
  const cliente = useQueryClient();
  const { pendientes, quitar, marcarIntentoFallido } = useColaOffline();
  const procesando = useRef(false);

  const procesar = useCallback(async () => {
    if (procesando.current) return;
    const cola = useColaOffline.getState().pendientes;
    if (cola.length === 0) return;

    procesando.current = true;
    try {
      for (const pendiente of cola) {
        await intentar(pendiente, quitar, marcarIntentoFallido);
      }
      void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuentas });
    } finally {
      procesando.current = false;
    }
  }, [cliente, quitar, marcarIntentoFallido]);

  useEffect(() => {
    void procesar();

    const alVolverLaSenal = () => void procesar();
    window.addEventListener('online', alVolverLaSenal);

    // Red de seguridad: el evento `online` no siempre dispara cuando el WiFi
    // sigue conectado pero el servidor no responde (el caso de la zona muerta).
    const reloj = pendientes.length > 0 ? setInterval(() => void procesar(), 15_000) : undefined;

    return () => {
      window.removeEventListener('online', alVolverLaSenal);
      if (reloj) clearInterval(reloj);
    };
  }, [procesar, pendientes.length]);

  return { pendientes, reintentar: procesar };
}

async function intentar(
  pendiente: PedidoPendiente,
  quitar: (key: string) => void,
  marcarIntentoFallido: (key: string, error: string) => void,
) {
  try {
    await endpoints.pedidos.enviar({
      cuenta_id: pendiente.cuenta_id,
      lineas: pendiente.lineas,
      idempotencia_key: pendiente.idempotencia_key,
    });
    quitar(pendiente.idempotencia_key);
  } catch (e) {
    if (e instanceof ErrorApi && !e.esDeConexion) {
      // Rechazo definitivo: sacarlo de la cola y dejar constancia del motivo.
      // (El pedido se pierde, pero la alternativa es un "pendiente" eterno.)
      quitar(pendiente.idempotencia_key);
      console.error('Pedido rechazado por el servidor:', e.message, pendiente);
      return;
    }
    marcarIntentoFallido(pendiente.idempotencia_key, 'Sin conexión');
  }
}
