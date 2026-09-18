import {
  EstadoLinea,
  EventosServidor,
  SEGUNDOS_DESHACER,
  SalaRealtime,
  agruparPorPlatillo,
  ordenarCola,
  type ColaCocina,
  type LineaCocina,
} from '@brisas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { useEventoSocket, useSocket } from '../../shared/hooks/useSocket';
import { gananciaDe, sonarCampana, useVolumen } from './sonido';

export const CLAVES_COCINA = {
  cola: ['cocina', 'cola'] as const,
};

/** Cuánto dura el parpadeo de una comanda recién llegada. */
const MS_PARPADEO = 6_000;

/** Cada cuánto se repinta el temporizador de las tarjetas. */
const MS_TICK = 10_000;

/**
 * Red de seguridad. Los datos llegan por Socket.IO, no por polling — pero la
 * tablet vive encendida todo el servicio, y si el socket se muere en silencio
 * (un proxy que corta la conexión, el router que se reinicia) la cocina se
 * quedaría ciega sin enterarse. Este refetch lento no reemplaza el tiempo real:
 * es lo que hace que la pantalla se recupere sola en el peor caso.
 */
const MS_RESPALDO = 30_000;

/** El siguiente estado al tocar la tarjeta, y la palabra que va en el botón. */
export const AVANCE: Record<string, { siguiente: EstadoLinea; palabra: string } | undefined> = {
  [EstadoLinea.ENVIADO]: { siguiente: EstadoLinea.EN_PREPARACION, palabra: 'EMPEZAR' },
  [EstadoLinea.EN_PREPARACION]: { siguiente: EstadoLinea.LISTO, palabra: 'LISTO' },
  // DECISIÓN: cocina también puede marcar ENTREGADO, y así el platillo sale de
  // la pantalla cuando la mesera se lo lleva. Sin esto la columna LISTOS crece
  // durante todo el servicio y deja de servir de un vistazo.
  [EstadoLinea.LISTO]: { siguiente: EstadoLinea.ENTREGADO, palabra: 'ENTREGADO' },
};

/** La acción que el botón grande DESHACER puede revertir. */
export interface AccionDeshacer {
  linea_id: number;
  producto_nombre: string;
  nombre_cliente: string;
  palabra: string;
  estado_anterior: EstadoLinea;
  /** Marca de tiempo local en la que deja de poder deshacerse. */
  vence_en: number;
}

export interface UsoCola {
  lineas: LineaCocina[];
  umbrales: { alerta: number; urgente: number };
  /** Hora del SERVIDOR corregida al reloj local. Se repinta sola cada 10 s. */
  ahora: number;
  conectado: boolean;
  cargando: boolean;
  /** Platillos de una comanda que acaba de entrar: parpadean unos segundos. */
  recienLlegadas: Set<number>;
  /** Platillos cuyo cambio de estado todavía va en camino. No se tocan de nuevo. */
  enVuelo: Set<number>;
  error: string | null;
  avanzar: (linea: LineaCocina) => void;
  deshacer: AccionDeshacer | null;
  ejecutarDeshacer: () => void;
}

/**
 * Todo el estado de la pantalla de cocina.
 *
 * La cola llega por Socket.IO y se mantiene en pantalla aunque se caiga la
 * conexión: React Query conserva lo último recibido y la pantalla nunca queda
 * en blanco. En cocina quedarse en blanco significaría perder la cola de
 * comandas en plena hora pico.
 */
export function useCola(): UsoCola {
  const cliente = useQueryClient();
  const { socket, conectado } = useSocket(SalaRealtime.COCINA);

  const [recienLlegadas, setRecienLlegadas] = useState<Set<number>>(new Set());
  const [enVuelo, setEnVuelo] = useState<Set<number>>(new Set());
  const [deshacer, setDeshacer] = useState<AccionDeshacer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const temporizadores = useRef<number[]>([]);

  const cola = useQuery({
    queryKey: CLAVES_COCINA.cola,
    queryFn: endpoints.pedidos.cocina,
    refetchInterval: MS_RESPALDO,
    staleTime: 0,
  });

  const refrescar = useCallback(() => {
    void cliente.invalidateQueries({ queryKey: CLAVES_COCINA.cola });
  }, [cliente]);

  // ── Tiempo real ───────────────────────────────────────────────────────────

  useEventoSocket<{ pedido_id: number }>(socket, EventosServidor.PEDIDO_NUEVO, (payload) => {
    // Campana suave + parpadeo: la cocinera puede estar de espaldas a la tablet.
    // Parpadean TODOS los platillos de la comanda nueva, aunque cada uno se
    // vaya a avanzar por separado — es una sola señal, "llegó pedido nuevo".
    sonarCampana(gananciaDe(useVolumen.getState().nivel));
    setRecienLlegadas((previas) => new Set(previas).add(payload.pedido_id));

    const id = window.setTimeout(() => {
      setRecienLlegadas((previas) => {
        const quedan = new Set(previas);
        quedan.delete(payload.pedido_id);
        return quedan;
      });
    }, MS_PARPADEO);
    temporizadores.current.push(id);

    refrescar();
  });

  useEventoSocket(socket, EventosServidor.PEDIDO_ESTADO, refrescar);
  useEventoSocket(socket, EventosServidor.LINEA_ESTADO, refrescar);
  useEventoSocket(socket, EventosServidor.CUENTA_ACTUALIZADA, refrescar);
  useEventoSocket(socket, EventosServidor.CUENTA_COBRADA, refrescar);

  // Al volver la señal, lo primero es ponerse al día: pudo entrar comida.
  useEffect(() => {
    if (conectado) refrescar();
  }, [conectado, refrescar]);

  // Repintado del temporizador de cada tarjeta.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), MS_TICK);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => pendientes.forEach(window.clearTimeout);
  }, []);

  // El DESHACER se apaga solo a los 30 segundos.
  useEffect(() => {
    if (!deshacer) return;
    const restante = Math.max(0, deshacer.vence_en - Date.now());
    const id = window.setTimeout(() => setDeshacer(null), restante);
    return () => window.clearTimeout(id);
  }, [deshacer]);

  // ── Cambiar de estado ─────────────────────────────────────────────────────

  const cambiar = useMutation({
    mutationFn: ({ linea_id, estado }: { linea_id: number; estado: EstadoLinea }) =>
      endpoints.pedidos.cambiarEstadoLinea(linea_id, estado),

    // Optimista a propósito: la tarjeta se mueve en el toque. Si la respuesta
    // tardara, la cocinera pensaría que no registró y volvería a tocar — y ese
    // segundo toque se llevaría el platillo dos estados adelante.
    onMutate: async ({ linea_id, estado }) => {
      await cliente.cancelQueries({ queryKey: CLAVES_COCINA.cola });
      const previo = cliente.getQueryData<ColaCocina>(CLAVES_COCINA.cola);

      cliente.setQueryData<ColaCocina>(CLAVES_COCINA.cola, (actual) =>
        actual
          ? {
              ...actual,
              lineas: actual.lineas.map((l) => (l.linea_id === linea_id ? { ...l, estado } : l)),
            }
          : actual,
      );

      setEnVuelo((previas) => new Set(previas).add(linea_id));
      return { previo };
    },

    onError: (fallo, _variables, contexto) => {
      if (contexto?.previo) cliente.setQueryData(CLAVES_COCINA.cola, contexto.previo);
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar el cambio');
      window.setTimeout(() => setError(null), 5_000);
    },

    onSettled: (_datos, _fallo, { linea_id }) => {
      setEnVuelo((previas) => {
        const quedan = new Set(previas);
        quedan.delete(linea_id);
        return quedan;
      });
      refrescar();
    },
  });

  const mutar = cambiar.mutate;

  const avanzar = useCallback(
    (linea: LineaCocina) => {
      const paso = AVANCE[linea.estado];
      if (!paso) return;

      mutar({ linea_id: linea.linea_id, estado: paso.siguiente });

      // DECISIÓN: se recuerda SOLO la última acción. Una pila de deshaceres
      // obligaría a leer y elegir; acá el botón siempre significa lo mismo —
      // "lo que acabo de tocar, no era".
      setDeshacer({
        linea_id: linea.linea_id,
        producto_nombre: linea.producto_nombre,
        nombre_cliente: linea.nombre_cliente,
        palabra: paso.palabra,
        estado_anterior: linea.estado,
        vence_en: Date.now() + SEGUNDOS_DESHACER * 1_000,
      });
    },
    [mutar],
  );

  const ejecutarDeshacer = useCallback(() => {
    if (!deshacer) return;
    mutar({ linea_id: deshacer.linea_id, estado: deshacer.estado_anterior });
    setDeshacer(null);
  }, [mutar, deshacer]);

  // ── Reloj del servidor ────────────────────────────────────────────────────

  // INVARIANTE 6: la hora la pone el servidor. Si la tablet tiene el reloj
  // corrido, el temporizador seguiría siendo correcto — mide contra la hora que
  // vino en la respuesta, no contra la del dispositivo.
  const desfase = cola.data ? Date.parse(cola.data.hora_servidor) - cola.dataUpdatedAt : 0;

  return {
    // Se reaplica acá para que la actualización optimista de `cambiar` (que
    // solo reemplaza el estado de UNA línea, sin tocar el orden del arreglo)
    // no pierda el agrupado por platillo que ya trajo el servidor.
    lineas: agruparPorPlatillo(ordenarCola(cola.data?.lineas ?? [])),
    umbrales: cola.data?.umbrales ?? { alerta: 10, urgente: 20 },
    ahora: Date.now() + desfase,
    conectado,
    cargando: cola.isLoading,
    recienLlegadas,
    enVuelo,
    error,
    avanzar,
    deshacer,
    ejecutarDeshacer,
  };
}
