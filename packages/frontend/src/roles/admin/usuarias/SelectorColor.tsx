import type { ColorPaletaEstado } from '@brisas/shared';

interface Props {
  paleta: ColorPaletaEstado[];
  valor: string;
  onCambio: (hex: string) => void;
  /** Id de la usuaria que se está editando: su propio color no cuenta como tomado. */
  usuariaId?: number;
  /** Solo las meseras reservan color; los demás roles pueden repetir. */
  exigirUnico: boolean;
}

/**
 * Selector de color de mesera.
 *
 * Los colores tomados se muestran igual, marcados y con el nombre de quien los
 * tiene: es más útil que esconderlos, porque explica por qué no se puede elegir.
 *
 * ⚠️ Cada opción lleva el NOMBRE del color en texto, no solo el cuadrito. Este
 * selector no puede depender del color para comunicar cuál es cuál — hay
 * daltonismo, y es exactamente el mismo motivo por el que en el salón el color
 * de la mesera va siempre acompañado de su nombre.
 */
export function SelectorColor({ paleta, valor, onCambio, usuariaId, exigirUnico }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {paleta.map((color) => {
        const esPropio = color.usado_por?.id === usuariaId;
        const tomado = exigirUnico && !color.libre && !esPropio;
        const elegido = color.hex.toUpperCase() === valor.toUpperCase();

        return (
          <li key={color.codigo}>
            <button
              type="button"
              disabled={tomado}
              aria-pressed={elegido}
              onClick={() => onCambio(color.hex)}
              className={`flex w-full items-center gap-2 rounded-lg border-2 p-2 text-left transition
                active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-marca/50 focus-visible:ring-offset-2
                ${elegido ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}
                ${tomado ? 'cursor-not-allowed opacity-40' : 'hover:border-slate-400'}`}
            >
              <span
                aria-hidden
                className="h-8 w-8 shrink-0 rounded-md ring-1 ring-black/10"
                style={{ backgroundColor: color.hex }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{color.nombre}</span>
                {tomado && (
                  <span className="block truncate text-xs text-slate-500">
                    lo tiene {color.usado_por?.nombre}
                  </span>
                )}
                {esPropio && <span className="block text-xs text-slate-500">color actual</span>}
              </span>
              {elegido && (
                <span aria-hidden className="text-lg text-slate-900">
                  ✓
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
