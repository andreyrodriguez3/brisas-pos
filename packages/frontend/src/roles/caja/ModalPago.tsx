import { FormaPago, formatearColones, type EstadoCobro, type ParteCobro } from '@brisas/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { Campo, Entrada } from '../../shared/ui/Campo';
import { Modal } from '../../shared/ui/Modal';
import { mensajeDeError } from '../admin/api';
import { FORMAS_PAGO } from './api';

interface Props {
  cuentaId: number;
  parte: ParteCobro | null;
  saldoCuenta: number;
  advertencias: string[];
  abierto: boolean;
  onCerrar: () => void;
  onListo: (nuevo: EstadoCobro) => void;
}

/**
 * Registrar un pago.
 *
 * ⚠️ Esto NO cobra nada. El sistema calcula el monto y deja constancia; el
 * datáfono, el SINPE y el efectivo siguen funcionando aparte, igual que hoy.
 * Por eso la forma de pago es un dato informativo y no cambia ningún cálculo.
 *
 * Se permite pagar de menos: la cuenta queda EN_COBRO con el saldo a la vista
 * hasta completarse. Lo que no se permite es pagar de más — un cero de sobra al
 * teclear inflaría el total del día sin que nadie lo note.
 */
export function ModalPago({ parte, abierto, onCerrar, ...resto }: Props) {
  return (
    <Modal
      titulo={parte ? `Cobrar — ${parte.etiqueta}` : 'Cobrar'}
      descripcion="El sistema registra el monto. El cobro se hace igual que hoy."
      abierto={abierto}
      onCerrar={onCerrar}
    >
      {/* La `key` remonta el formulario al cambiar de parte: así el monto
          propuesto y la forma de pago arrancan limpios sin ningún efecto. */}
      {parte && <Formulario key={parte.numero} parte={parte} onCerrar={onCerrar} {...resto} />}
    </Modal>
  );
}

function Formulario({
  cuentaId,
  parte,
  saldoCuenta,
  advertencias,
  onCerrar,
  onListo,
}: Omit<Props, 'abierto' | 'parte'> & { parte: ParteCobro }) {
  const sinEntregar = advertencias.find((a) => a.startsWith('Cocina'));
  const aCobrar = Math.min(parte.saldo, saldoCuenta);

  // El caso normal es cobrar la parte completa: se propone ese monto.
  const [monto, setMonto] = useState(String(aCobrar));
  const [forma, setForma] = useState<FormaPago>(FormaPago.EFECTIVO);
  const [forzar, setForzar] = useState(false);
  // Con cuánto paga el cliente: solo para calcular el vuelto en efectivo, no
  // se manda al backend. El monto que salda la cuenta sigue siendo `monto`.
  const [conCuanto, setConCuanto] = useState('');

  const numero = Number.parseInt(monto, 10);
  const valido = Number.isInteger(numero) && numero > 0 && numero <= saldoCuenta;
  const parcial = valido && numero < aCobrar;

  const recibido = Number.parseInt(conCuanto, 10);
  const vuelto = Number.isInteger(recibido) && valido && recibido >= numero ? recibido - numero : null;

  const pagar = useMutation({
    mutationFn: () =>
      endpoints.cobro.registrarPago(cuentaId, {
        monto: numero,
        forma_pago: forma,
        parte_num: parte.numero,
        forzar,
      }),
    onSuccess: onListo,
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-slate-50 p-3">
        A cobrar: <strong className="tabular-nums">{formatearColones(aCobrar)}</strong>
        {saldoCuenta !== aCobrar && (
          <span className="block text-sm text-slate-500">
            Saldo total de la cuenta: {formatearColones(saldoCuenta)}
          </span>
        )}
      </p>

      <Campo etiqueta="Cuánto se recibe" requerido ayuda="Se puede cobrar en varias veces.">
        {(props) => (
          <Entrada
            {...props}
            type="number"
            inputMode="numeric"
            min={1}
            max={saldoCuenta}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="text-xl tabular-nums"
          />
        )}
      </Campo>

      <Campo etiqueta="Forma de pago" ayuda="Informativa: el sistema no procesa cobros.">
        {() => (
          <div className="grid grid-cols-4 gap-2">
            {FORMAS_PAGO.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setForma(f.valor as FormaPago)}
                className={`min-h-boton-normal rounded-lg text-sm font-semibold ${
                  forma === f.valor ? 'bg-marca text-white' : 'bg-white ring-1 ring-slate-300'
                }`}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
        )}
      </Campo>

      {forma === FormaPago.EFECTIVO && (
        <Campo etiqueta="Con cuánto paga" ayuda="Opcional: para calcular el vuelto.">
          {(props) => (
            <Entrada
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              value={conCuanto}
              onChange={(e) => setConCuanto(e.target.value)}
              placeholder={String(numero || '')}
              className="text-xl tabular-nums"
            />
          )}
        </Campo>
      )}

      {vuelto !== null && (
        <p className="rounded-lg bg-marca-claro p-3">
          Vuelto: <strong className="tabular-nums">{formatearColones(vuelto)}</strong>
        </p>
      )}

      {parcial && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Es un pago parcial: quedan{' '}
          <strong className="tabular-nums">{formatearColones(aCobrar - numero)}</strong> de esta
          parte. La cuenta queda abierta con el saldo a la vista.
        </p>
      )}

      {sinEntregar && (
        <label className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <input
            type="checkbox"
            checked={forzar}
            onChange={(e) => setForzar(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>
            <strong>{sinEntregar}.</strong> Confirmo que se cobra igual. Queda registrado en la
            bitácora.
          </span>
        </label>
      )}

      {pagar.isError && <p className="text-sm text-red-700">{mensajeDeError(pagar.error)}</p>}

      <div className="flex justify-end gap-3 border-t pt-4">
        <button type="button" className="boton-secundario" onClick={onCerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={!valido || pagar.isPending || (Boolean(sinEntregar) && !forzar)}
          onClick={() => pagar.mutate()}
        >
          {pagar.isPending ? 'Registrando…' : 'Registrar el pago'}
        </button>
      </div>
    </div>
  );
}
