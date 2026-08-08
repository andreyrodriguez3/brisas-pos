import { useEffect, useState } from 'react';
import type { AccionDeshacer } from './useCola';

interface Props {
  accion: AccionDeshacer | null;
  onDeshacer: () => void;
}

/**
 * El botón DESHACER.
 *
 * Reemplaza a los diálogos de confirmación, que en cocina no existen: confirmar
 * antes cansa —son cientos de toques por servicio— y deshacer después perdona.
 * Dura 30 segundos y muestra los que le quedan, para que nadie se quede
 * esperando a ver si todavía puede.
 */
export function BarraDeshacer({ accion, onDeshacer }: Props) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (!accion) return;

    const recalcular = () =>
      setSegundos(Math.max(0, Math.ceil((accion.vence_en - Date.now()) / 1_000)));

    recalcular();
    const id = window.setInterval(recalcular, 1_000);
    return () => window.clearInterval(id);
  }, [accion]);

  if (!accion || segundos <= 0) return null;

  return (
    <button
      type="button"
      onClick={onDeshacer}
      className="boton-cocina gap-4 bg-slate-900 px-6 shadow-lg"
    >
      <span>↶ Deshacer</span>
      <span className="truncate font-normal normal-case opacity-90">
        {accion.nombre_cliente} · {accion.palabra}
      </span>
      <span className="ml-auto tabular-nums opacity-80">{segundos}s</span>
    </button>
  );
}
