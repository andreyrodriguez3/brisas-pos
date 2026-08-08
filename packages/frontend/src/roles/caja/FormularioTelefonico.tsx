import { CanalCuenta, formatearColones, PRECIO_ENVASE_DEFAULT, CLAVES_CONFIG } from '@brisas/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../../shared/api/endpoints';
import { Campo, Entrada } from '../../shared/ui/Campo';
import { mensajeDeError } from '../admin/api';

/** Propone la hora de retiro redondeada a los próximos 30 minutos. */
function horaSugerida(): string {
  const t = new Date(Date.now() + 30 * 60_000);
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() < 30 ? 30 : 60);
  // El <input type="datetime-local"> quiere hora local sin zona.
  const local = new Date(t.getTime() - t.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Pedido telefónico para llevar.
 *
 * Suena el teléfono, la caja anota y el cliente pasa a recoger. Son tres datos y
 * después el menú: el formulario abre la cuenta y salta directo a tomar el
 * pedido, sin pasos intermedios — el cliente está esperando en la línea.
 *
 * ⚠️ La cuenta nace con `canal = PARA_LLEVAR`, y eso es lo que hace que toda su
 * venta vaya a la cuenta aparte de la dueña. No tiene mesera responsable: su
 * venta no es atribuible a nadie del salón.
 */
export function FormularioTelefonico() {
  const navegar = useNavigate();

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [hora, setHora] = useState(horaSugerida);

  const config = useQuery({
    queryKey: ['configuracion'],
    queryFn: endpoints.configuracion.todas,
    staleTime: 5 * 60_000,
  });
  const precioEnvase =
    Number.parseInt(config.data?.[CLAVES_CONFIG.PRECIO_ENVASE] ?? '', 10) || PRECIO_ENVASE_DEFAULT;

  const abrir = useMutation({
    mutationFn: () =>
      endpoints.cuentas.abrir({
        canal: CanalCuenta.PARA_LLEVAR,
        nombre_cliente: nombre.trim(),
        telefono: telefono.trim(),
        hora_retiro: new Date(hora).toISOString(),
        referencia: null,
        mesera_responsable_id: null,
      }),
    // Directo al menú: el cliente sigue en el teléfono.
    onSuccess: (cuenta) => navegar(`/caja/cuenta/${cuenta.id}/pedido`),
  });

  const completo = nombre.trim().length >= 2 && /^\d{4}-?\d{4}$/.test(telefono.trim()) && hora !== '';

  return (
    <div className="flex flex-1 justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold">Pedido para llevar</h1>
        <p className="mt-1 text-slate-600">
          Se abre la cuenta y se pasa directo al menú.
        </p>

        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (completo) abrir.mutate();
          }}
        >
          <Campo etiqueta="Nombre de quien recoge" requerido>
            {(props) => (
              <Entrada
                {...props}
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Sr. Rojas"
              />
            )}
          </Campo>

          <Campo etiqueta="Teléfono" requerido ayuda="8 dígitos.">
            {(props) => (
              <Entrada
                {...props}
                inputMode="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="8888-7777"
              />
            )}
          </Campo>

          <Campo
            etiqueta="Hora de retiro"
            requerido
            ayuda="Ordena la cola de cocina: es lo que decide cuándo lo empiezan."
          >
            {(props) => (
              <Entrada
                {...props}
                type="datetime-local"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            )}
          </Campo>

          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            El envase de <strong>{formatearColones(precioEnvase)}</strong> se agrega solo, uno por
            platillo. La venta va completa a la cuenta de para llevar.
          </p>

          {abrir.isError && <p className="text-sm text-red-700">{mensajeDeError(abrir.error)}</p>}

          <button
            type="submit"
            className="boton-primario min-h-tactil w-full text-base"
            disabled={!completo || abrir.isPending}
          >
            {abrir.isPending ? 'Abriendo…' : 'Abrir cuenta y tomar el pedido'}
          </button>
        </form>
      </div>
    </div>
  );
}
