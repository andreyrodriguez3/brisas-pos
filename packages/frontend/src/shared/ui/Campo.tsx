import { useId } from 'react';

interface CampoProps {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  children: (props: { id: string; 'aria-invalid'?: boolean }) => React.ReactNode;
}

/** Etiqueta + control + texto de ayuda o error, con los ids bien atados. */
export function Campo({ etiqueta, ayuda, error, requerido, children }: CampoProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {etiqueta}
        {requerido && <span className="ml-0.5 text-red-600">*</span>}
      </label>

      {children({ id, 'aria-invalid': error ? true : undefined })}

      {error ? (
        <p className="text-sm font-medium text-red-700">{error}</p>
      ) : (
        ayuda && <p className="text-sm text-slate-500">{ayuda}</p>
      )}
    </div>
  );
}

const CLASES_CONTROL =
  'min-h-boton-normal w-full rounded-lg border border-slate-300 px-3 text-base ' +
  'focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30 ' +
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/30 ' +
  'disabled:bg-slate-100 disabled:text-slate-500';

export function Entrada(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CLASES_CONTROL} ${props.className ?? ''}`} />;
}

export function Seleccion(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CLASES_CONTROL} ${props.className ?? ''}`} />;
}

export function AreaTexto(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CLASES_CONTROL} py-2 ${props.className ?? ''}`} />;
}

/**
 * Entrada de colones.
 *
 * Solo acepta enteros: el dinero en este sistema no tiene decimales. Vacío
 * significa "sin precio cargado" (null), que es un estado real del menú — las
 * bebidas que entraron sin precio de las fotos están así.
 */
export function EntradaColones({
  valor,
  onCambio,
  ...props
}: {
  valor: number | null;
  onCambio: (valor: number | null) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        ₡
      </span>
      <input
        {...props}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={valor ?? ''}
        placeholder="sin precio"
        onChange={(e) => {
          const crudo = e.target.value;
          if (crudo === '') return onCambio(null);
          const n = Number.parseInt(crudo, 10);
          onCambio(Number.isNaN(n) ? null : Math.max(0, n));
        }}
        className={`${CLASES_CONTROL} pl-7 tabular-nums ${props.className ?? ''}`}
      />
    </div>
  );
}
