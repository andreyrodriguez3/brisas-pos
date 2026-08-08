import type { CategoriaAdmin, GrupoOpcionAdmin, ProductoAdmin } from '@brisas/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../../shared/api/endpoints';
import { AreaTexto, Campo, Entrada, EntradaColones, Seleccion } from '../../../shared/ui/Campo';
import { MensajeError } from '../../../shared/ui/Cargando';
import { Insignia } from '../../../shared/ui/Insignia';
import { Interruptor } from '../../../shared/ui/Interruptor';
import { Modal } from '../../../shared/ui/Modal';
import { mensajeDeError, useRefrescarMenu } from '../api';

interface VarianteForm {
  etiqueta: string;
  precio_colones: number | null;
  activo: boolean;
  /** Solo las que ya existen; sirve para avisar que no se borran, se desactivan. */
  id?: number;
}

interface Props {
  producto: ProductoAdmin | null;
  categorias: CategoriaAdmin[];
  categoriaInicial: number | null;
  gruposOpcion: GrupoOpcionAdmin[];
  onCerrar: () => void;
}

export function FormularioProducto({
  producto,
  categorias,
  categoriaInicial,
  gruposOpcion,
  onCerrar,
}: Props) {
  const esNuevo = producto === null;
  const refrescar = useRefrescarMenu();

  const [categoriaId, setCategoriaId] = useState(
    producto?.categoria_id ?? categoriaInicial ?? categorias[0]?.id ?? 0,
  );
  const [nombreEs, setNombreEs] = useState(producto?.nombre_es ?? '');
  const [nombreEn, setNombreEn] = useState(producto?.nombre_en ?? '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [esEnvase, setEsEnvase] = useState(producto?.es_envase ?? false);
  const [gruposIds, setGruposIds] = useState<number[]>(producto?.grupos_opcion_ids ?? []);
  const [variantes, setVariantes] = useState<VarianteForm[]>(
    producto?.variantes.map((v) => ({
      id: v.id,
      etiqueta: v.etiqueta,
      precio_colones: v.precio_colones,
      activo: v.activo,
    })) ?? [{ etiqueta: 'Único', precio_colones: null, activo: true }],
  );

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        categoria_id: categoriaId,
        nombre_es: nombreEs.trim(),
        nombre_en: nombreEn.trim() || null,
        descripcion: descripcion.trim() || null,
        es_envase: esEnvase,
        orden: producto?.orden ?? 0,
        grupos_opcion_ids: gruposIds,
        variantes: variantes.map((v, i) => ({
          // El id va cuando la variante ya existe: así cambiar la etiqueta la
          // RENOMBRA en vez de apagar la vieja y crear otra.
          ...(v.id !== undefined ? { id: v.id } : {}),
          etiqueta: v.etiqueta.trim(),
          precio_colones: v.precio_colones,
          orden: i,
          activo: v.activo,
        })),
      };
      return esNuevo
        ? endpoints.menu.crearProducto(payload)
        : endpoints.menu.actualizarProducto(producto.id, payload);
    },
    onSuccess: () => {
      refrescar();
      onCerrar();
    },
  });

  // Validación local, con los mismos límites que el schema Zod del backend.
  const etiquetas = variantes.map((v) => v.etiqueta.trim().toLowerCase());
  const hayEtiquetaVacia = etiquetas.some((e) => e === '');
  const hayEtiquetaRepetida = new Set(etiquetas).size !== etiquetas.length;
  const puedeGuardar =
    nombreEs.trim().length >= 2 &&
    categoriaId > 0 &&
    variantes.length > 0 &&
    !hayEtiquetaVacia &&
    !hayEtiquetaRepetida;

  const sinNingunPrecio = variantes.every((v) => v.precio_colones === null);

  return (
    <Modal
      abierto
      ancho="ancho"
      titulo={esNuevo ? 'Producto nuevo' : producto.nombre_es}
      descripcion={
        esNuevo ? undefined : 'Los cambios no tocan las cuentas que ya están abiertas.'
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
                value={nombreEs}
                autoFocus
                onChange={(e) => setNombreEs(e.target.value)}
                placeholder="Casado con pollo"
              />
            )}
          </Campo>

          <Campo etiqueta="Categoría" requerido>
            {(p) => (
              <Seleccion
                {...p}
                value={categoriaId}
                onChange={(e) => setCategoriaId(Number(e.target.value))}
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Seleccion>
            )}
          </Campo>

          <Campo etiqueta="Nombre en inglés" ayuda="Opcional. Para los turistas.">
            {(p) => (
              <Entrada {...p} value={nombreEn} onChange={(e) => setNombreEn(e.target.value)} />
            )}
          </Campo>

          <Campo etiqueta="Descripción" ayuda="Opcional.">
            {(p) => (
              <AreaTexto
                {...p}
                rows={2}
                maxLength={300}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            )}
          </Campo>
        </div>

        {/* ── Variantes y precios ─────────────────────────────────────────── */}

        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Precios</h3>
            {sinNingunPrecio && <Insignia tono="alerta">Sin precio: no se puede vender</Insignia>}
          </div>
          <p className="text-sm text-slate-500">
            Un producto con varios tamaños lleva una fila por tamaño. Dejar el precio en blanco
            significa «todavía no lo sabemos»: el producto se guarda, pero no se puede pedir.
          </p>

          <ul className="flex flex-col gap-2">
            {variantes.map((v, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={`Etiqueta de la variante ${i + 1}`}
                  value={v.etiqueta}
                  placeholder="Único / Pequeño / Grande"
                  onChange={(e) => actualizarVariante(setVariantes, i, { etiqueta: e.target.value })}
                  className="min-h-boton-normal min-w-40 flex-1 rounded-lg border border-slate-300 px-3
                             focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
                />

                <div className="w-36">
                  <EntradaColones
                    aria-label={`Precio de la variante ${i + 1}`}
                    valor={v.precio_colones}
                    onCambio={(precio) =>
                      actualizarVariante(setVariantes, i, { precio_colones: precio })
                    }
                  />
                </div>

                <button
                  type="button"
                  onClick={() => actualizarVariante(setVariantes, i, { activo: !v.activo })}
                  className={`min-h-boton-normal rounded-lg px-3 text-sm font-medium ${
                    v.activo ? 'text-slate-500 hover:bg-slate-100' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {v.activo ? 'Activa' : 'Apagada'}
                </button>

                <button
                  type="button"
                  aria-label={`Quitar la variante ${i + 1}`}
                  disabled={variantes.length === 1}
                  title={
                    v.id
                      ? 'Se desactiva, no se borra: puede haber cuentas viejas que la usaron'
                      : undefined
                  }
                  onClick={() => setVariantes((vs) => vs.filter((_, j) => j !== i))}
                  className="min-h-boton-normal rounded-lg px-3 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {hayEtiquetaVacia && (
            <p className="text-sm font-medium text-red-700">Cada precio necesita una etiqueta.</p>
          )}
          {hayEtiquetaRepetida && (
            <p className="text-sm font-medium text-red-700">
              Hay dos etiquetas iguales. Cambiá una para poder distinguirlas.
            </p>
          )}

          <button
            type="button"
            className="boton-secundario self-start text-sm"
            onClick={() =>
              setVariantes((vs) => [...vs, { etiqueta: '', precio_colones: null, activo: true }])
            }
          >
            + Agregar tamaño
          </button>
        </section>

        {/* ── Grupos de opción ────────────────────────────────────────────── */}

        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Opciones que se preguntan al pedirlo</h3>
          <p className="text-sm text-slate-500">
            Por ejemplo el acompañamiento: «¿papas o yuca?». Los grupos se crean en la pestaña
            Opciones.
          </p>

          {gruposOpcion.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay grupos de opción creados.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {gruposOpcion.map((g) => (
                <li key={g.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 accent-[#15803D]"
                      checked={gruposIds.includes(g.id)}
                      onChange={(e) =>
                        setGruposIds((ids) =>
                          e.target.checked ? [...ids, g.id] : ids.filter((x) => x !== g.id),
                        )
                      }
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">
                        {g.nombre}
                        {g.obligatorio && <span className="ml-2 text-xs text-red-600">obligatorio</span>}
                      </span>
                      <span className="block text-sm text-slate-500">
                        {g.opciones
                          .filter((o) => o.activo)
                          .map((o) => o.nombre)
                          .join(' · ')}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Envase ──────────────────────────────────────────────────────── */}

        <section className="rounded-lg bg-slate-50 p-4">
          <Interruptor
            activo={esEnvase}
            onCambio={setEsEnvase}
            etiqueta="Este producto es el envase"
            detalle="Lo que se cobre con este producto va al totalizador de envases, aparte de las ventas de salón y de para llevar. Normalmente solo hay uno."
          />
        </section>
      </div>
    </Modal>
  );
}

function actualizarVariante(
  set: React.Dispatch<React.SetStateAction<VarianteForm[]>>,
  indice: number,
  cambios: Partial<VarianteForm>,
) {
  set((vs) => vs.map((v, i) => (i === indice ? { ...v, ...cambios } : v)));
}
