export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-slate-500">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-6 w-6 animate-spin text-slate-300"
        fill="none"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="text-marca"
        />
      </svg>
      <span>{texto}</span>
    </div>
  );
}

export function MensajeError({ texto }: { texto: string }) {
  return (
    <div role="alert" className="m-4 rounded-lg bg-red-50 p-4 text-red-800 ring-1 ring-red-200">
      {texto}
    </div>
  );
}

export function Vacio({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <svg aria-hidden viewBox="0 0 24 24" className="h-10 w-10 text-slate-300" fill="none">
        <path
          d="M4 8.5 12 4l8 4.5M4 8.5 12 13m-8-4.5V16l8 4.5m0-7.5v7.5m0-7.5 8-4.5m-8 12 8-4.5v-7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-lg font-semibold text-slate-700">{titulo}</p>
      {detalle && <p className="text-sm text-slate-500">{detalle}</p>}
    </div>
  );
}
