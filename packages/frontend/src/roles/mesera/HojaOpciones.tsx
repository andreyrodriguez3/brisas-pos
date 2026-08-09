import {
  formatearColones,
  type GrupoOpcion,
  type Opcion,
  type ProductoCompleto,
  type Variante,
} from '@brisas/shared';
import { useState } from 'react';
import { Modal } from '../../shared/ui/Modal';
import type { ItemCarrito } from './estado/carrito';

interface Props {
  producto: ProductoCompleto;
  onAgregar: (item: Omit<ItemCarrito, 'clave'>) => void;
  onCerrar: () => void;
}

/**
 * Hoja de opciones: se abre al tocar un platillo.
 *
 * Variante (tamaño), grupos de opción, cantidad, nota y la marca de para llevar.
 * El botón de agregar muestra el total ya calculado, para que la mesera pueda
 * confirmarle el precio al cliente sin hacer cuentas.
 */
export function HojaOpciones({ producto, onAgregar, onCerrar }: Props) {
  const [variante, setVariante] = useState<Variante>(producto.variantes[0]);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState('');
  const [paraLlevar, setParaLlevar] = useState(false);
  const [elegidas, setElegidas] = useState<Record<number, number[]>>(() =>
    // Los grupos obligatorios de una sola opción arrancan con la primera puesta:
    // es lo que la mesera iba a tocar igual.
    Object.fromEntries(
      producto.grupos_opcion
        .filter((g) => g.obligatorio && g.max_sel === 1 && (g.opciones?.length ?? 0) > 0)
        .map((g) => [g.id, [g.opciones![0].id]]),
    ),
  );

  function alternar(grupo: GrupoOpcion, opcion: Opcion) {
    setElegidas((prev) => {
      const actuales = prev[grupo.id] ?? [];
      const yaEsta = actuales.includes(opcion.id);

      if (yaEsta) {
        // No se puede desmarcar la última de un grupo obligatorio.
        if (grupo.obligatorio && actuales.length <= grupo.min_sel) return prev;
        return { ...prev, [grupo.id]: actuales.filter((id) => id !== opcion.id) };
      }

      if (grupo.max_sel === 1) return { ...prev, [grupo.id]: [opcion.id] };
      if (actuales.length >= grupo.max_sel) return prev;
      return { ...prev, [grupo.id]: [...actuales, opcion.id] };
    });
  }

  const opcionesElegidas = producto.grupos_opcion.flatMap((grupo) =>
    (elegidas[grupo.id] ?? []).flatMap((id) => {
      const opcion = grupo.opciones?.find((o) => o.id === id);
      return opcion ? [{ grupo, opcion }] : [];
    }),
  );

  const faltantes = producto.grupos_opcion.filter(
    (g) => g.obligatorio && (elegidas[g.id]?.length ?? 0) < g.min_sel,
  );

  const extras = opcionesElegidas.reduce((t, o) => t + o.opcion.precio_extra, 0);
  const total = ((variante.precio_colones ?? 0) + extras) * cantidad;

  return (
    <Modal
      abierto
      titulo={producto.nombre_es}
      descripcion={producto.descripcion ?? undefined}
      onCerrar={onCerrar}
      pie={
        <button
          type="button"
          className="boton-primario min-h-tactil w-full text-lg"
          disabled={faltantes.length > 0}
          onClick={() => {
            onAgregar({
              producto,
              variante,
              cantidad,
              opciones: opcionesElegidas,
              nota,
              para_llevar: paraLlevar,
            });
            onCerrar();
          }}
        >
          {faltantes.length > 0
            ? `Elegí ${faltantes[0].nombre.toLowerCase()}`
            : `Agregar · ${formatearColones(total)}`}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        {producto.variantes.length > 1 && (
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">Tamaño</h3>
            <div className="grid grid-cols-2 gap-2">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={v.id === variante.id}
                  onClick={() => setVariante(v)}
                  className={`min-h-tactil rounded-xl border-2 p-3 text-left transition active:scale-[0.98]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/50
                    focus-visible:ring-offset-2 ${
                      v.id === variante.id ? 'border-marca bg-marca-claro' : 'border-slate-200'
                    }`}
                >
                  <span className="block font-medium">{v.etiqueta}</span>
                  <span className="block text-sm text-slate-600">
                    {formatearColones(v.precio_colones ?? 0)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {producto.grupos_opcion.map((grupo) => (
          <section key={grupo.id} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h3 className="font-semibold">{grupo.nombre}</h3>
              {grupo.obligatorio ? (
                <span className="text-xs font-medium text-red-600">obligatorio</span>
              ) : (
                <span className="text-xs text-slate-400">opcional</span>
              )}
              {grupo.max_sel > 1 && (
                <span className="text-xs text-slate-400">hasta {grupo.max_sel}</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {grupo.opciones?.map((opcion) => {
                const puesta = (elegidas[grupo.id] ?? []).includes(opcion.id);
                return (
                  <button
                    key={opcion.id}
                    type="button"
                    aria-pressed={puesta}
                    onClick={() => alternar(grupo, opcion)}
                    className={`flex min-h-tactil items-center gap-3 rounded-xl border-2 px-3 text-left
                      transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2
                      focus-visible:ring-marca/50 focus-visible:ring-offset-2 ${
                        puesta ? 'border-marca bg-marca-claro' : 'border-slate-200'
                      }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        puesta ? 'border-marca bg-marca text-white' : 'border-slate-300'
                      }`}
                    >
                      {puesta && '✓'}
                    </span>
                    <span className="flex-1 font-medium">{opcion.nombre}</span>
                    {opcion.precio_extra > 0 && (
                      <span className="text-sm font-medium text-marca">
                        +{formatearColones(opcion.precio_extra)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Cantidad</h3>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Menos"
              disabled={cantidad <= 1}
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              className="min-h-tactil min-w-tactil rounded-xl border-2 border-slate-200 text-2xl font-bold
                transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-marca/50 focus-visible:ring-offset-2 disabled:opacity-30
                disabled:active:scale-100"
            >
              −
            </button>
            <span className="min-w-12 text-center text-2xl font-bold tabular-nums">{cantidad}</span>
            <button
              type="button"
              aria-label="Más"
              onClick={() => setCantidad((c) => c + 1)}
              className="min-h-tactil min-w-tactil rounded-xl border-2 border-slate-200 text-2xl font-bold
                transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-marca/50 focus-visible:ring-offset-2"
            >
              +
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <label htmlFor="nota-platillo" className="font-semibold">
            Nota para la cocina
          </label>
          <textarea
            id="nota-platillo"
            rows={2}
            maxLength={200}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="SIN CEBOLLA"
            className="min-h-tactil w-full rounded-lg border border-slate-300 px-3 py-2 uppercase
                       placeholder:normal-case focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
          />
          {/* En cocina la nota sale en mayúsculas y destacada: es el dato que
              más se pasa por alto y el que más devoluciones causa. */}
          <p className="text-xs text-slate-500">
            En la comanda sale en mayúsculas y resaltada.
          </p>
        </section>

        {/*
          ⚠️ Marcar esto SOLO agrega el cargo del envase. La venta sigue siendo
          de salón: no se mueve ni un colón de bolsa.
        */}
        <section className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <button
            type="button"
            role="switch"
            aria-checked={paraLlevar}
            onClick={() => setParaLlevar((v) => !v)}
            className="flex w-full items-start gap-3 text-left"
          >
            <span
              className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
                paraLlevar ? 'bg-amber-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  paraLlevar ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                }`}
              />
            </span>
            <span className="flex-1">
              <span className="block font-medium">Se lo lleva</span>
              <span className="block text-sm text-slate-600">
                Le sobró y pide llevárselo. Se le cobra el envase aparte.
              </span>
            </span>
          </button>
        </section>
      </div>
    </Modal>
  );
}
