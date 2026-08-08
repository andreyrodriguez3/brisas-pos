import type { GrupoOpcionAdmin } from '@brisas/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../../shared/api/endpoints';
import { Campo, Entrada, EntradaColones } from '../../../shared/ui/Campo';
import { MensajeError } from '../../../shared/ui/Cargando';
import { Interruptor } from '../../../shared/ui/Interruptor';
import { Modal } from '../../../shared/ui/Modal';
import { mensajeDeError, useRefrescarMenu } from '../api';

interface OpcionForm {
  nombre: string;
  precio_extra: number;
  activo: boolean;
  id?: number;
}

export function FormularioGrupoOpcion({
  grupo,
  onCerrar,
}: {
  grupo: GrupoOpcionAdmin | null;
  onCerrar: () => void;
}) {
  const esNuevo = grupo === null;
  const refrescar = useRefrescarMenu();

  const [nombre, setNombre] = useState(grupo?.nombre ?? '');
  const [codigo, setCodigo] = useState(grupo?.codigo ?? '');
  const [obligatorio, setObligatorio] = useState(grupo?.obligatorio ?? false);
  const [minSel, setMinSel] = useState(grupo?.min_sel ?? 1);
  const [maxSel, setMaxSel] = useState(grupo?.max_sel ?? 1);
  const [opciones, setOpciones] = useState<OpcionForm[]>(
    grupo?.opciones.map((o) => ({
      id: o.id,
      nombre: o.nombre,
      precio_extra: o.precio_extra,
      activo: o.activo,
    })) ?? [{ nombre: '', precio_extra: 0, activo: true }],
  );

  const guardar = useMutation({
    mutationFn: () => {
      const listaOpciones = opciones.map((o) => ({
        // Igual que con las variantes: con id se renombra, sin id se crea.
        ...(o.id !== undefined ? { id: o.id } : {}),
        nombre: o.nombre.trim(),
        precio_extra: o.precio_extra,
        activo: o.activo,
      }));

      return esNuevo
        ? endpoints.menu.crearGrupoOpcion({
            codigo: codigo.trim().toUpperCase(),
            nombre: nombre.trim(),
            obligatorio,
            min_sel: minSel,
            max_sel: maxSel,
            opciones: listaOpciones,
          })
        : endpoints.menu.actualizarGrupoOpcion(grupo.id, {
            nombre: nombre.trim(),
            obligatorio,
            min_sel: minSel,
            max_sel: maxSel,
            opciones: listaOpciones,
          });
    },
    onSuccess: () => {
      refrescar();
      onCerrar();
    },
  });

  const nombres = opciones.map((o) => o.nombre.trim().toLowerCase());
  const hayVacia = nombres.some((n) => n === '');
  const hayRepetida = new Set(nombres).size !== nombres.length;
  const maxMenorQueMin = maxSel < minSel;
  const obligatorioSinMinimo = obligatorio && minSel < 1;

  const puedeGuardar =
    nombre.trim().length >= 2 &&
    (!esNuevo || codigo.trim().length >= 2) &&
    opciones.length > 0 &&
    !hayVacia &&
    !hayRepetida &&
    !maxMenorQueMin &&
    !obligatorioSinMinimo;

  return (
    <Modal
      abierto
      ancho="ancho"
      titulo={esNuevo ? 'Grupo de opción nuevo' : `Editar ${grupo.nombre}`}
      descripcion={
        esNuevo
          ? undefined
          : `Lo usan ${grupo._count.productos} producto${grupo._count.productos === 1 ? '' : 's'}.`
      }
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton-primario"
            disabled={!puedeGuardar || guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {guardar.isError && <MensajeError texto={mensajeDeError(guardar.error)} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" requerido>
            {(p) => (
              <Entrada
                {...p}
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Acompañamiento"
              />
            )}
          </Campo>

          {esNuevo && (
            <Campo etiqueta="Código" requerido ayuda="Interno, sin espacios. No cambia después.">
              {(p) => (
                <Entrada
                  {...p}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  placeholder="ACOMP_PAPAS_YUCA"
                />
              )}
            </Campo>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 p-4">
          <Interruptor
            activo={obligatorio}
            onCambio={(valor) => {
              setObligatorio(valor);
              // Activar "obligatorio" con el mínimo en 0 sería contradictorio.
              if (valor && minSel < 1) setMinSel(1);
            }}
            etiqueta="Hay que elegir sí o sí"
            detalle="La mesera no puede mandar el platillo a cocina sin contestar esto."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Mínimo de opciones"
            error={obligatorioSinMinimo ? 'Un grupo obligatorio necesita al menos 1' : undefined}
          >
            {(p) => (
              <Entrada
                {...p}
                type="number"
                min={0}
                value={minSel}
                onChange={(e) => setMinSel(Math.max(0, Number(e.target.value) || 0))}
              />
            )}
          </Campo>

          <Campo
            etiqueta="Máximo de opciones"
            ayuda="Poné más de 1 si se pueden elegir varias."
            error={maxMenorQueMin ? 'No puede ser menor que el mínimo' : undefined}
          >
            {(p) => (
              <Entrada
                {...p}
                type="number"
                min={1}
                value={maxSel}
                onChange={(e) => setMaxSel(Math.max(1, Number(e.target.value) || 1))}
              />
            )}
          </Campo>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Opciones</h3>
          <p className="text-sm text-slate-500">
            El costo extra se suma al precio del platillo. Dejalo en 0 si no cuesta más.
          </p>

          <ul className="flex flex-col gap-2">
            {opciones.map((o, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={`Nombre de la opción ${i + 1}`}
                  value={o.nombre}
                  placeholder="Papas"
                  onChange={(e) => actualizarOpcion(setOpciones, i, { nombre: e.target.value })}
                  className="min-h-boton-normal min-w-40 flex-1 rounded-lg border border-slate-300 px-3
                             focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
                />

                <div className="w-36">
                  <EntradaColones
                    aria-label={`Costo extra de la opción ${i + 1}`}
                    valor={o.precio_extra}
                    onCambio={(v) => actualizarOpcion(setOpciones, i, { precio_extra: v ?? 0 })}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => actualizarOpcion(setOpciones, i, { activo: !o.activo })}
                  className={`min-h-boton-normal rounded-lg px-3 text-sm font-medium ${
                    o.activo ? 'text-slate-500 hover:bg-slate-100' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {o.activo ? 'Activa' : 'Apagada'}
                </button>

                <button
                  type="button"
                  aria-label={`Quitar la opción ${i + 1}`}
                  disabled={opciones.length === 1}
                  title={
                    o.id
                      ? 'Se desactiva, no se borra: hay comandas viejas que la usaron'
                      : undefined
                  }
                  onClick={() => setOpciones((os) => os.filter((_, j) => j !== i))}
                  className="min-h-boton-normal rounded-lg px-3 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {hayVacia && <p className="text-sm font-medium text-red-700">Toda opción necesita nombre.</p>}
          {hayRepetida && (
            <p className="text-sm font-medium text-red-700">Hay dos opciones con el mismo nombre.</p>
          )}

          <button
            type="button"
            className="boton-secundario self-start text-sm"
            onClick={() =>
              setOpciones((os) => [...os, { nombre: '', precio_extra: 0, activo: true }])
            }
          >
            + Agregar opción
          </button>
        </section>
      </div>
    </Modal>
  );
}

function actualizarOpcion(
  set: React.Dispatch<React.SetStateAction<OpcionForm[]>>,
  indice: number,
  cambios: Partial<OpcionForm>,
) {
  set((os) => os.map((o, i) => (i === indice ? { ...o, ...cambios } : o)));
}
