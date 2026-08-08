import { formatearColones, type GrupoOpcionAdmin } from '@brisas/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../../shared/api/endpoints';
import { Cargando, MensajeError, Vacio } from '../../../shared/ui/Cargando';
import { Insignia } from '../../../shared/ui/Insignia';
import { CLAVES, mensajeDeError } from '../api';
import { FormularioGrupoOpcion } from './FormularioGrupoOpcion';

/**
 * Grupos de opción: lo que se le pregunta a la mesera cuando toca un platillo.
 * "¿Papas o yuca?", "¿Qué proteína lleva el casado?".
 */
export function PantallaGruposOpcion() {
  const [editando, setEditando] = useState<GrupoOpcionAdmin | 'nuevo' | null>(null);

  const grupos = useQuery({ queryKey: CLAVES.gruposOpcion, queryFn: endpoints.menu.gruposOpcion });

  if (grupos.isLoading) return <Cargando />;
  if (grupos.isError) return <MensajeError texto={mensajeDeError(grupos.error)} />;

  const lista = grupos.data ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold">Opciones</h2>
          <p className="text-sm text-slate-500">
            Lo que la mesera elige al tocar un platillo. Un grupo se puede usar en varios productos.
          </p>
        </div>
        <button className="boton-primario" onClick={() => setEditando('nuevo')}>
          + Grupo
        </button>
      </header>

      {lista.length === 0 ? (
        <Vacio
          titulo="Todavía no hay grupos de opción"
          detalle="Creá uno para preguntar el acompañamiento, la proteína o el relleno."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lista.map((grupo) => (
            <li key={grupo.id} className="tarjeta flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold">{grupo.nombre}</h3>
                  <p className="font-mono text-xs text-slate-400">{grupo.codigo}</p>
                </div>
                <button className="boton-secundario text-sm" onClick={() => setEditando(grupo)}>
                  Editar
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {grupo.obligatorio ? (
                  <Insignia tono="aviso">Obligatorio</Insignia>
                ) : (
                  <Insignia>Opcional</Insignia>
                )}
                <Insignia tono="info">
                  {grupo.min_sel === grupo.max_sel
                    ? `Elegir ${grupo.max_sel}`
                    : `Elegir ${grupo.min_sel} a ${grupo.max_sel}`}
                </Insignia>
                <Insignia>
                  {grupo._count.productos} producto{grupo._count.productos === 1 ? '' : 's'}
                </Insignia>
              </div>

              <ul className="flex flex-wrap gap-1.5">
                {grupo.opciones.map((o) => (
                  <li
                    key={o.id}
                    className={`rounded-md px-2 py-1 text-sm ${
                      o.activo
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-slate-50 text-slate-400 line-through'
                    }`}
                  >
                    {o.nombre}
                    {o.precio_extra > 0 && (
                      <span className="ml-1 font-medium text-marca">
                        +{formatearColones(o.precio_extra)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <FormularioGrupoOpcion
          grupo={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}
