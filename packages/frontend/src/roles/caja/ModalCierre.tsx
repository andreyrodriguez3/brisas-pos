import type { CierreCompleto } from '@brisas/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { AreaTexto, Campo } from '../../shared/ui/Campo';
import { Modal } from '../../shared/ui/Modal';
import { mensajeDeError } from '../admin/api';
import { TablaCierre } from './TablaCierre';

interface Props {
  turnoId: number;
  abierto: boolean;
  puedeCerrar: boolean;
  sinResolver: number;
  onCerrar: () => void;
  onListo: () => void;
}

/**
 * Cerrar el día.
 *
 * Primero se ven los números —vista previa, sin guardar nada— y recién después
 * se cierra. El cierre es inmutable: no se puede cerrar dos veces el mismo
 * turno, así que conviene mirarlo antes.
 */
export function ModalCierre({
  turnoId,
  abierto,
  puedeCerrar,
  sinResolver,
  onCerrar,
  onListo,
}: Props) {
  const [motivo, setMotivo] = useState('');
  const [hecho, setHecho] = useState<CierreCompleto | null>(null);

  const previa = useQuery({
    queryKey: ['turnos', turnoId, 'previa'],
    queryFn: () => endpoints.turnos.previa(turnoId),
    enabled: abierto && hecho === null,
  });

  const cerrar = useMutation({
    mutationFn: () =>
      endpoints.turnos.cerrar(turnoId, { forzar: !puedeCerrar, motivo: motivo.trim() || undefined }),
    onSuccess: (cierre) => {
      setHecho(cierre);
      onListo();
    },
  });

  const datos = hecho ?? previa.data;

  return (
    <Modal
      titulo={hecho ? 'Día cerrado' : 'Cierre del día'}
      descripcion={
        hecho
          ? 'Queda guardado como registro histórico. Se puede volver a imprimir cuando haga falta.'
          : 'Así quedarían los números. Todavía no se guardó nada.'
      }
      abierto={abierto}
      onCerrar={() => {
        setHecho(null);
        setMotivo('');
        cerrar.reset();
        onCerrar();
      }}
      ancho="ancho"
      pie={
        hecho ? (
          <button
            type="button"
            className="boton-primario"
            onClick={() => {
              setHecho(null);
              onCerrar();
            }}
          >
            Listo
          </button>
        ) : (
          <>
            <button type="button" className="boton-secundario" onClick={onCerrar}>
              Todavía no
            </button>
            <button
              type="button"
              className="boton-primario"
              disabled={cerrar.isPending || (!puedeCerrar && motivo.trim().length < 3)}
              onClick={() => cerrar.mutate()}
            >
              {cerrar.isPending ? 'Cerrando…' : 'Cerrar el día'}
            </button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {!hecho && !puedeCerrar && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">
              Quedan {sinResolver} cuenta(s) sin cobrar ni anular.
            </p>
            <p>
              Se puede cerrar igual, pero esa comida queda fuera del cierre y la caja no va a
              cuadrar. Hace falta un motivo.
            </p>
          </div>
        )}

        {!hecho && !puedeCerrar && (
          <Campo etiqueta="Motivo del cierre forzado" requerido>
            {(props) => (
              <AreaTexto
                {...props}
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            )}
          </Campo>
        )}

        {previa.isLoading && <p className="text-slate-500">Calculando…</p>}
        {previa.isError && <p className="text-red-700">{mensajeDeError(previa.error)}</p>}
        {cerrar.isError && <p className="text-red-700">{mensajeDeError(cerrar.error)}</p>}

        {datos && <TablaCierre cierre={datos} />}
      </div>
    </Modal>
  );
}
