import { useEffect, useRef } from 'react';

interface Props {
  titulo: string;
  descripcion?: string;
  abierto: boolean;
  onCerrar: () => void;
  children: React.ReactNode;
  pie?: React.ReactNode;
  ancho?: 'normal' | 'ancho';
}

/**
 * Diálogo modal para el panel de admin.
 *
 * Usa `<dialog>` nativo, así que el navegador se encarga del foco atrapado, del
 * fondo inerte y de la tecla Escape sin que tengamos que reimplementarlo.
 *
 * Nota: esto es para ADMIN y CAJA. En cocina no hay diálogos — ahí la regla es
 * un toque y un botón grande de DESHACER.
 */
export function Modal({
  titulo,
  descripcion,
  abierto,
  onCerrar,
  children,
  pie,
  ancho = 'normal',
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Escape cierra, pero avisamos al padre para que actualice su estado.
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        // Clic en el fondo (fuera de la tarjeta) cierra.
        if (e.target === ref.current) onCerrar();
      }}
      className={`w-full rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px] ${
        ancho === 'ancho' ? 'max-w-3xl' : 'max-w-lg'
      }`}
    >
      <form method="dialog" className="flex max-h-[85dvh] flex-col">
        <header className="flex items-start gap-4 border-b px-6 py-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="min-h-tactil min-w-tactil rounded-lg text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {pie && <footer className="flex justify-end gap-3 border-t bg-slate-50 px-6 py-4">{pie}</footer>}
      </form>
    </dialog>
  );
}
