export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
      <span className="animate-pulse">{texto}</span>
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
    <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
      <p className="text-lg font-semibold text-slate-700">{titulo}</p>
      {detalle && <p className="text-sm text-slate-500">{detalle}</p>}
    </div>
  );
}
