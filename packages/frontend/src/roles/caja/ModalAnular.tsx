import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { AreaTexto, Campo } from '../../shared/ui/Campo';
import { Modal } from '../../shared/ui/Modal';
import { mensajeDeError } from '../admin/api';

interface Props {
  cuentaId: number;
  abierto: boolean;
  onCerrar: () => void;
  onListo: () => void;
}

/**
 * Anular una cuenta.
 *
 * INVARIANTE 4: no se borra nada. La cuenta queda ANULADA, con su motivo y el
 * nombre de quien la anuló, y sigue apareciendo en el cierre del día — la dueña
 * tiene que poder ver qué se anuló y quién lo hizo.
 *
 * Solo caja y la dueña pueden, y el backend lo valida (`@Roles`), no la interfaz.
 */
export function ModalAnular({ cuentaId, abierto, onCerrar, onListo }: Props) {
  const [motivo, setMotivo] = useState('');

  const anular = useMutation({
    mutationFn: () => endpoints.cuentas.anular(cuentaId, motivo.trim()),
    onSuccess: () => {
      setMotivo('');
      anular.reset();
      onListo();
      onCerrar();
    },
  });

  return (
    <Modal
      titulo="Anular la cuenta"
      descripcion="No se borra: queda anulada, con tu nombre y el motivo."
      abierto={abierto}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            No, volver
          </button>
          <button
            type="button"
            className="boton-peligro"
            disabled={motivo.trim().length < 3 || anular.isPending}
            onClick={() => anular.mutate()}
          >
            Anular
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Sus comandas salen de la pantalla de cocina. Si ya se cobró algo, primero hay que resolver
          los pagos.
        </p>

        <Campo etiqueta="Motivo" requerido ayuda="Ej.: «el cliente se fue», «se abrió dos veces».">
          {(props) => (
            <AreaTexto
              {...props}
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          )}
        </Campo>

        {anular.isError && <p className="text-sm text-red-700">{mensajeDeError(anular.error)}</p>}
      </div>
    </Modal>
  );
}
