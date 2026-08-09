import { TipoDescuento, calcularDescuento, formatearColones } from '@brisas/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { AreaTexto, Campo, Entrada } from '../../shared/ui/Campo';
import { Modal } from '../../shared/ui/Modal';
import { mensajeDeError } from '../admin/api';

interface Props {
  cuentaId: number;
  /** Lo que hay que cobrar ahora. El descuento se calcula sobre esto. */
  total: number;
  abierto: boolean;
  onCerrar: () => void;
  onListo: () => void;
}

const TIPOS = [
  { valor: TipoDescuento.MONTO, etiqueta: 'Monto fijo', ayuda: 'Le quito ₡X' },
  { valor: TipoDescuento.PORCENTAJE, etiqueta: 'Porcentaje', ayuda: 'Le quito el X%' },
  { valor: TipoDescuento.CORTESIA, etiqueta: 'Cortesía', ayuda: 'La casa invita: se va todo' },
] as const;

/**
 * Descuento o cortesía.
 *
 * El motivo es obligatorio siempre. Un descuento sin explicación es un hueco en
 * la caja que nadie puede reconstruir tres semanas después — y esto lo autoriza
 * caja o la dueña, así que el nombre de quien lo hizo queda en la bitácora.
 *
 * La pantalla muestra el resultado ANTES de guardar: la cajera ve en cuánto
 * queda la cuenta sin tener que confiar en una cuenta mental.
 */
export function ModalDescuento({ cuentaId, total, abierto, onCerrar, onListo }: Props) {
  const [tipo, setTipo] = useState<TipoDescuento>(TipoDescuento.MONTO);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');

  const numero = Number.parseInt(valor, 10);
  const valorValido = tipo === TipoDescuento.CORTESIA || (Number.isInteger(numero) && numero > 0);

  // Se previsualiza con la MISMA función de shared que corre en el servidor.
  const vistaPrevia =
    valorValido && (tipo !== TipoDescuento.PORCENTAJE || numero <= 100)
      ? calcularDescuento(total, { tipo, valor: Number.isNaN(numero) ? 0 : numero })
      : null;

  const guardar = useMutation({
    mutationFn: () =>
      endpoints.cobro.aplicarDescuento(cuentaId, {
        tipo,
        valor: tipo === TipoDescuento.CORTESIA ? 0 : numero,
        motivo: motivo.trim(),
      }),
    onSuccess: () => {
      onListo();
      limpiar();
      onCerrar();
    },
  });

  const limpiar = () => {
    setTipo(TipoDescuento.MONTO);
    setValor('');
    setMotivo('');
    guardar.reset();
  };

  return (
    <Modal
      titulo="Descuento o cortesía"
      descripcion="Queda registrado a tu nombre, con el motivo."
      abierto={abierto}
      onCerrar={() => {
        limpiar();
        onCerrar();
      }}
      pie={
        <>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => {
              limpiar();
              onCerrar();
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="boton-primario"
            disabled={!valorValido || motivo.trim().length < 3 || guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            Aplicar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTipo(t.valor)}
              className={`rounded-lg border p-3 text-left transition active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/50
                focus-visible:ring-offset-2 ${
                  tipo === t.valor
                    ? 'border-marca bg-marca-claro ring-2 ring-marca/20 ring-offset-2'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
            >
              <span className="block font-semibold">{t.etiqueta}</span>
              <span className="block text-xs text-slate-500">{t.ayuda}</span>
            </button>
          ))}
        </div>

        {tipo !== TipoDescuento.CORTESIA && (
          <Campo
            etiqueta={tipo === TipoDescuento.MONTO ? 'Cuántos colones' : 'Qué porcentaje'}
            requerido
            ayuda={tipo === TipoDescuento.PORCENTAJE ? 'De 1 a 100' : undefined}
          >
            {(props) => (
              <Entrada
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                max={tipo === TipoDescuento.PORCENTAJE ? 100 : undefined}
                value={valor}
                onChange={(ev) => setValor(ev.target.value)}
                className="tabular-nums"
              />
            )}
          </Campo>
        )}

        <Campo
          etiqueta="Motivo"
          requerido
          ayuda="Obligatorio. Ej.: «se demoró el pedido», «cliente frecuente»."
        >
          {(props) => (
            <AreaTexto
              {...props}
              rows={2}
              value={motivo}
              onChange={(ev) => setMotivo(ev.target.value)}
            />
          )}
        </Campo>

        {vistaPrevia !== null && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm">
            Se le quitan <strong>{formatearColones(vistaPrevia)}</strong>. La cuenta queda en{' '}
            <strong className="tabular-nums">{formatearColones(total - vistaPrevia)}</strong>.
          </p>
        )}

        {guardar.isError && <p className="text-sm text-red-700">{mensajeDeError(guardar.error)}</p>}
      </div>
    </Modal>
  );
}
