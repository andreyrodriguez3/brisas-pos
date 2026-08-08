import type { CategoriaAdmin } from '@brisas/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../../shared/api/endpoints';
import { Campo, Entrada } from '../../../shared/ui/Campo';
import { MensajeError } from '../../../shared/ui/Cargando';
import { Interruptor } from '../../../shared/ui/Interruptor';
import { Modal } from '../../../shared/ui/Modal';
import { mensajeDeError, useRefrescarMenu } from '../api';

interface Props {
  categoria: CategoriaAdmin | null;
  onCerrar: () => void;
}

export function FormularioCategoria({ categoria, onCerrar }: Props) {
  const esNueva = categoria === null;
  const refrescar = useRefrescarMenu();

  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [codigo, setCodigo] = useState(categoria?.codigo ?? '');
  const [activo, setActivo] = useState(categoria?.activo ?? true);

  const guardar = useMutation({
    mutationFn: () =>
      esNueva
        ? endpoints.menu.crearCategoria({
            nombre: nombre.trim(),
            codigo: codigo.trim().toUpperCase(),
            orden: 0,
          })
        : endpoints.menu.actualizarCategoria(categoria.id, { nombre: nombre.trim(), activo }),
    onSuccess: () => {
      refrescar();
      onCerrar();
    },
  });

  const nProductos = categoria?.productos.length ?? 0;
  const puedeGuardar =
    nombre.trim().length >= 2 && (!esNueva || codigo.trim().length >= 2);

  return (
    <Modal
      abierto
      titulo={esNueva ? 'Categoría nueva' : `Editar ${categoria.nombre}`}
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

        <Campo etiqueta="Nombre" requerido>
          {(p) => (
            <Entrada
              {...p}
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Platos fuertes"
            />
          )}
        </Campo>

        {esNueva ? (
          <Campo
            etiqueta="Código"
            requerido
            ayuda="Identificador interno, sin espacios. No se puede cambiar después."
          >
            {(p) => (
              <Entrada
                {...p}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                placeholder="PLATOS_FUERTES"
              />
            )}
          </Campo>
        ) : (
          <div className="rounded-lg bg-slate-50 p-4">
            <Interruptor
              activo={activo}
              onCambio={setActivo}
              etiqueta="Categoría visible en el menú"
              detalle={
                activo
                  ? `Sus ${nProductos} productos se pueden pedir.`
                  : `Se oculta junto con sus ${nProductos} productos. No se borra nada: se puede volver a activar cuando sea.`
              }
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
