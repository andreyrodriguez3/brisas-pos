interface Props {
  onDigito: (digito: string) => void;
  onBorrar: () => void;
  onLimpiar: () => void;
  deshabilitado?: boolean;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Teclado numérico grande en pantalla.
 *
 * NO se usa el teclado del sistema: en un celular con la pantalla sucia y las
 * manos ocupadas, el teclado nativo abre pequeño, tapa media pantalla y a veces
 * ni sale en modo PWA. Estas teclas miden 64 px de lado como mínimo.
 */
export function TecladoNumerico({ onDigito, onBorrar, onLimpiar, deshabilitado }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TECLAS.map((tecla) => (
        <button
          key={tecla}
          type="button"
          disabled={deshabilitado}
          onClick={() => onDigito(tecla)}
          className="min-h-tactil rounded-xl bg-white text-3xl font-bold text-slate-800
                     shadow-sm ring-1 ring-slate-200 transition active:scale-95
                     active:bg-slate-100 disabled:opacity-40"
        >
          {tecla}
        </button>
      ))}

      <button
        type="button"
        disabled={deshabilitado}
        onClick={onLimpiar}
        className="min-h-tactil rounded-xl bg-slate-100 text-base font-semibold text-slate-600
                   transition active:scale-95 disabled:opacity-40"
      >
        Limpiar
      </button>

      <button
        type="button"
        disabled={deshabilitado}
        onClick={() => onDigito('0')}
        className="min-h-tactil rounded-xl bg-white text-3xl font-bold text-slate-800
                   shadow-sm ring-1 ring-slate-200 transition active:scale-95
                   active:bg-slate-100 disabled:opacity-40"
      >
        0
      </button>

      <button
        type="button"
        disabled={deshabilitado}
        aria-label="Borrar"
        onClick={onBorrar}
        className="min-h-tactil rounded-xl bg-slate-100 text-2xl font-semibold text-slate-600
                   transition active:scale-95 disabled:opacity-40"
      >
        ←
      </button>
    </div>
  );
}
