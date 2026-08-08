interface Props {
  activo: boolean;
  onCambio: (activo: boolean) => void;
  etiqueta: string;
  /** Se muestra bajo la etiqueta. Sirve para explicar qué significa apagarlo. */
  detalle?: string;
  deshabilitado?: boolean;
  /** Ámbar para "agotado hoy", que es temporal; verde para activo/inactivo. */
  tono?: 'marca' | 'ambar';
}

/** Interruptor con etiqueta clicable y estado accesible. */
export function Interruptor({
  activo,
  onCambio,
  etiqueta,
  detalle,
  deshabilitado,
  tono = 'marca',
}: Props) {
  const encendido = tono === 'ambar' ? 'bg-amber-500' : 'bg-marca';

  return (
    <label
      className={`flex items-start gap-3 ${
        deshabilitado ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={etiqueta}
        disabled={deshabilitado}
        onClick={() => onCambio(!activo)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          activo ? encendido : 'bg-slate-300'
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            activo ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
          }`}
        />
      </button>

      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-700">{etiqueta}</span>
        {detalle && <span className="block text-sm text-slate-500">{detalle}</span>}
      </span>
    </label>
  );
}
