import { Rol, buscarColorMesera, type Usuario } from '@brisas/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../../shared/api/endpoints';
import { Cargando, MensajeError } from '../../../shared/ui/Cargando';
import { Insignia } from '../../../shared/ui/Insignia';
import { CLAVES, mensajeDeError, useRefrescarUsuarias } from '../api';
import { FormularioUsuaria } from './FormularioUsuaria';

const ETIQUETA_ROL: Record<Rol, string> = {
  MESERA: 'Mesera',
  CAJA: 'Caja',
  ADMIN: 'Administradora',
  COCINA: 'Cocina',
};

export function PantallaUsuarias() {
  const [editando, setEditando] = useState<Usuario | 'nueva' | null>(null);

  const usuarias = useQuery({
    queryKey: CLAVES.usuarias,
    queryFn: () => endpoints.usuarios.listar(true),
  });
  const paleta = useQuery({ queryKey: CLAVES.paleta, queryFn: endpoints.usuarios.paleta });

  if (usuarias.isLoading || paleta.isLoading) return <Cargando />;
  if (usuarias.isError) return <MensajeError texto={mensajeDeError(usuarias.error)} />;

  const lista = usuarias.data ?? [];
  const activas = lista.filter((u) => u.activo);
  const inactivas = lista.filter((u) => !u.activo);
  const coloresLibres = (paleta.data ?? []).filter((c) => c.libre).length;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold">Usuarias</h2>
          <p className="text-sm text-slate-500">
            {activas.length} activas · {coloresLibres} color{coloresLibres === 1 ? '' : 'es'} libre
            {coloresLibres === 1 ? '' : 's'} en la paleta
          </p>
        </div>
        <button
          className="boton-primario"
          disabled={coloresLibres === 0}
          title={
            coloresLibres === 0
              ? 'No quedan colores libres. Desactivá una mesera o cambiale el color primero.'
              : undefined
          }
          onClick={() => setEditando('nueva')}
        >
          + Usuaria
        </button>
      </header>

      <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900 ring-1 ring-blue-200">
        El color identifica sus cuentas en el celular, en la tablet de cocina y en caja, pero{' '}
        <strong>nunca va solo</strong>: siempre lo acompaña el nombre en texto, porque hay
        daltonismo y la terraza recibe sol directo.
      </p>

      <ul className="flex flex-col gap-2">
        {activas.map((u) => (
          <FilaUsuaria key={u.id} usuaria={u} onEditar={() => setEditando(u)} />
        ))}
      </ul>

      {inactivas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Desactivadas
          </h3>
          <p className="text-sm text-slate-500">
            No se borran nunca: sus cuentas viejas y sus ventas atribuidas siguen siendo suyas.
          </p>
          <ul className="flex flex-col gap-2">
            {inactivas.map((u) => (
              <FilaUsuaria key={u.id} usuaria={u} onEditar={() => setEditando(u)} />
            ))}
          </ul>
        </section>
      )}

      {editando && (
        <FormularioUsuaria
          usuaria={editando === 'nueva' ? null : editando}
          paleta={paleta.data ?? []}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function FilaUsuaria({ usuaria, onEditar }: { usuaria: Usuario; onEditar: () => void }) {
  const refrescar = useRefrescarUsuarias();

  const cambiarActivo = useMutation({
    mutationFn: (activo: boolean) => endpoints.usuarios.cambiarActivo(usuaria.id, activo),
    onSuccess: refrescar,
  });

  const nombreColor = buscarColorMesera(usuaria.color_hex)?.nombre;

  return (
    <li
      className={`tarjeta-mesera flex flex-wrap items-center gap-3 ${
        usuaria.activo ? '' : 'tarjeta-ajena'
      }`}
      style={{ borderLeftColor: usuaria.color_hex }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{usuaria.nombre}</span>
          <Insignia tono={usuaria.rol === Rol.ADMIN ? 'info' : 'neutro'}>
            {ETIQUETA_ROL[usuaria.rol as Rol]}
          </Insignia>
          {!usuaria.activo && <Insignia tono="alerta">Desactivada</Insignia>}
        </div>
        {/* El nombre del color en texto, nunca solo el cuadrito. */}
        <p className="text-sm text-slate-500">Color: {nombreColor ?? usuaria.color_hex}</p>
      </div>

      {cambiarActivo.isError && (
        <p className="w-full text-sm font-medium text-red-700">
          {mensajeDeError(cambiarActivo.error)}
        </p>
      )}

      <button
        type="button"
        disabled={cambiarActivo.isPending}
        onClick={() => cambiarActivo.mutate(!usuaria.activo)}
        className="min-h-boton-normal rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
      >
        {usuaria.activo ? 'Desactivar' : 'Reactivar'}
      </button>

      <button className="boton-secundario text-sm" onClick={onEditar}>
        Editar
      </button>
    </li>
  );
}
