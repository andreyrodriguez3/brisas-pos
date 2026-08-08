type Tono = 'neutro' | 'aviso' | 'alerta' | 'ok' | 'info';

const TONOS: Record<Tono, string> = {
  neutro: 'bg-slate-100 text-slate-600',
  aviso: 'bg-amber-100 text-amber-900',
  alerta: 'bg-red-100 text-red-800',
  ok: 'bg-green-100 text-green-800',
  info: 'bg-blue-100 text-blue-800',
};

export function Insignia({
  children,
  tono = 'neutro',
}: {
  children: React.ReactNode;
  tono?: Tono;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}
