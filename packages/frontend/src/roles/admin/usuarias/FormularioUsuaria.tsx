import { Rol, type ColorPaletaEstado, type Usuario } from '@brisas/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../../shared/api/endpoints';
import { Campo, Entrada, Seleccion } from '../../../shared/ui/Campo';
import { MensajeError } from '../../../shared/ui/Cargando';
import { Modal } from '../../../shared/ui/Modal';
import { mensajeDeError, useRefrescarUsuarias } from '../api';
import { SelectorColor } from './SelectorColor';

const ROLES: Array<{ valor: Rol; etiqueta: string; detalle: string }> = [
  { valor: Rol.MESERA, etiqueta: 'Mesera', detalle: 'Abre cuentas y manda pedidos desde su celular' },
  { valor: Rol.CAJA, etiqueta: 'Caja', detalle: 'Todo lo de mesera, más cobrar y cerrar el turno' },
  { valor: Rol.ADMIN, etiqueta: 'Administradora', detalle: 'Todo, más menú, usuarias y reportes' },
  { valor: Rol.COCINA, etiqueta: 'Cocina', detalle: 'Identidad de la tablet. No se loguea nadie con ella' },
];

interface Props {
  usuaria: Usuario | null;
  paleta: ColorPaletaEstado[];
  onCerrar: () => void;
}

export function FormularioUsuaria({ usuaria, paleta, onCerrar }: Props) {
  const esNueva = usuaria === null;
  const refrescar = useRefrescarUsuarias();

  const [nombre, setNombre] = useState(usuaria?.nombre ?? '');
  const [rol, setRol] = useState<Rol>((usuaria?.rol as Rol) ?? Rol.MESERA);
  const [pin, setPin] = useState('');
  const [colorHex, setColorHex] = useState(
    usuaria?.color_hex ?? paleta.find((c) => c.libre)?.hex ?? paleta[0]?.hex ?? '',
  );

  const guardar = useMutation({
    mutationFn: () =>
      esNueva
        ? endpoints.usuarios.crear({ nombre: nombre.trim(), rol, pin, color_hex: colorHex })
        : endpoints.usuarios.actualizar(usuaria.id, {
            nombre: nombre.trim(),
            rol,
            color_hex: colorHex,
            // El PIN solo viaja si de verdad se está cambiando.
            ...(pin ? { pin } : {}),
          }),
    onSuccess: () => {
      refrescar();
      onCerrar();
    },
  });

  const pinValido = pin === '' ? !esNueva : /^\d{4}$/.test(pin);
  const puedeGuardar = nombre.trim().length >= 2 && colorHex !== '' && pinValido;

  return (
    <Modal
      abierto
      titulo={esNueva ? 'Usuaria nueva' : `Editar ${usuaria.nombre}`}
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

        <Campo etiqueta="Nombre" requerido ayuda="Es lo que ven las compañeras en las tres pantallas.">
          {(p) => (
            <Entrada
              {...p}
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ana"
            />
          )}
        </Campo>

        <Campo etiqueta="Rol" requerido ayuda={ROLES.find((r) => r.valor === rol)?.detalle}>
          {(p) => (
            <Seleccion {...p} value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </Seleccion>
          )}
        </Campo>

        <Campo
          etiqueta={esNueva ? 'PIN de 4 dígitos' : 'PIN nuevo'}
          requerido={esNueva}
          ayuda={
            esNueva
              ? 'Con esto entra desde su celular.'
              : 'Dejalo en blanco para no cambiarlo. Poner uno nuevo también desbloquea a quien se quedó afuera por marcar mal el PIN.'
          }
          error={pin !== '' && !/^\d{4}$/.test(pin) ? 'Son exactamente 4 dígitos' : undefined}
        >
          {(p) => (
            <Entrada
              {...p}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={pin}
              placeholder={esNueva ? '1234' : '••••'}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          )}
        </Campo>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">
            Color<span className="ml-0.5 text-red-600">*</span>
          </span>
          <p className="text-sm text-slate-500">
            {rol === Rol.MESERA
              ? 'Identifica sus cuentas en las tres pantallas. Dos meseras activas no pueden tener el mismo.'
              : 'Este rol no reserva color: solo las meseras necesitan distinguirse en el salón.'}
          </p>
          <SelectorColor
            paleta={paleta}
            valor={colorHex}
            onCambio={setColorHex}
            usuariaId={usuaria?.id}
            exigirUnico={rol === Rol.MESERA}
          />
        </div>
      </div>
    </Modal>
  );
}
