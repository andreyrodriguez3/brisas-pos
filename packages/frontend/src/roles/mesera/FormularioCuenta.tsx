import { CanalCuenta } from '@brisas/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../../shared/api/endpoints';
import { AreaTexto, Campo, Entrada } from '../../shared/ui/Campo';
import { MensajeError } from '../../shared/ui/Cargando';
import { Modal } from '../../shared/ui/Modal';
import { mensajeDeError } from '../admin/api';
import { CLAVES_MESERA } from './useEnviarPedido';

/**
 * Abrir una cuenta.
 *
 * El restaurante no usa números de mesa: la cuenta se identifica por el nombre
 * del cliente. Se permiten nombres repetidos en el mismo turno — la lista los
 * desambigua con la hora y el color de la mesera.
 */
export function FormularioCuenta({ onCerrar }: { onCerrar: () => void }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();

  const [canal, setCanal] = useState<CanalCuenta>(CanalCuenta.SALON);
  const [nombre, setNombre] = useState('');
  const [referencia, setReferencia] = useState('');
  const [telefono, setTelefono] = useState('');
  const [horaRetiro, setHoraRetiro] = useState('');

  const abrir = useMutation({
    mutationFn: () =>
      endpoints.cuentas.abrir({
        canal,
        nombre_cliente: nombre.trim(),
        referencia: referencia.trim() || null,
        ...(canal === CanalCuenta.PARA_LLEVAR
          ? {
              telefono: telefono.replace(/\D/g, ''),
              hora_retiro: new Date(horaRetiro).toISOString(),
            }
          : {}),
      }),
    onSuccess: (cuenta) => {
      void cliente.invalidateQueries({ queryKey: CLAVES_MESERA.cuentas });
      onCerrar();
      navegar(`/mesera/cuenta/${cuenta.id}/pedido`);
    },
  });

  const esParaLlevar = canal === CanalCuenta.PARA_LLEVAR;
  const puedeAbrir =
    nombre.trim().length >= 2 &&
    (!esParaLlevar || (telefono.replace(/\D/g, '').length === 8 && horaRetiro !== ''));

  return (
    <Modal
      abierto
      titulo="Nueva cuenta"
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton-primario"
            disabled={!puedeAbrir || abrir.isPending}
            onClick={() => abrir.mutate()}
          >
            {abrir.isPending ? 'Abriendo…' : 'Abrir y tomar pedido'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {abrir.isError && <MensajeError texto={mensajeDeError(abrir.error)} />}

        {/*
          El canal se fija ACÁ y no cambia nunca: es lo único que decide si la
          venta va a salón o a la cuenta aparte de la dueña.
        */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">¿Cómo es el pedido?</span>
          <div className="grid grid-cols-2 gap-2">
            <BotonCanal
              elegido={canal === CanalCuenta.SALON}
              titulo="Se sienta a comer"
              detalle="Venta de salón"
              onClick={() => setCanal(CanalCuenta.SALON)}
            />
            <BotonCanal
              elegido={esParaLlevar}
              titulo="Pasa a recoger"
              detalle="Cuenta aparte de la dueña"
              onClick={() => setCanal(CanalCuenta.PARA_LLEVAR)}
            />
          </div>
          <p className="text-xs text-slate-500">
            Esto no se puede cambiar después. Si alguien del salón después pide llevarse lo que le
            sobró, se marca el platillo y se le cobra el envase — la venta sigue siendo de salón.
          </p>
        </div>

        <Campo etiqueta="Nombre del cliente" requerido ayuda="Como lo vas a llamar. Puede repetirse.">
          {(p) => (
            <Entrada
              {...p}
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Don Carlos"
              autoComplete="off"
            />
          )}
        </Campo>

        <Campo etiqueta="Referencia" ayuda="Opcional. Para no confundirte si hay dos iguales.">
          {(p) => (
            <AreaTexto
              {...p}
              rows={2}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="terraza · 4 personas"
            />
          )}
        </Campo>

        {esParaLlevar && (
          <>
            <Campo etiqueta="Teléfono" requerido ayuda="8 dígitos.">
              {(p) => (
                <Entrada
                  {...p}
                  type="tel"
                  inputMode="numeric"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="8888 7777"
                />
              )}
            </Campo>

            <Campo etiqueta="Hora de retiro" requerido ayuda="Cocina ordena estos pedidos por esta hora.">
              {(p) => (
                <Entrada
                  {...p}
                  type="datetime-local"
                  value={horaRetiro}
                  onChange={(e) => setHoraRetiro(e.target.value)}
                />
              )}
            </Campo>
          </>
        )}
      </div>
    </Modal>
  );
}

function BotonCanal({
  elegido,
  titulo,
  detalle,
  onClick,
}: {
  elegido: boolean;
  titulo: string;
  detalle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={elegido}
      onClick={onClick}
      className={`min-h-tactil rounded-xl border p-3 text-left transition active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/50
        focus-visible:ring-offset-2 ${
          elegido
            ? 'border-marca bg-marca-claro ring-2 ring-marca/20 ring-offset-2'
            : 'border-slate-200 bg-white'
        }`}
    >
      <span className="block font-semibold">{titulo}</span>
      <span className="block text-xs text-slate-500">{detalle}</span>
    </button>
  );
}
