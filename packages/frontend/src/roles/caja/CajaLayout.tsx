import { EventosServidor, SalaRealtime } from '@brisas/shared';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useSesion } from '../../shared/estado/sesion';
import { useEventoSocket, useSocket } from '../../shared/hooks/useSocket';
import { BannerSinConexion } from '../../shared/ui/BannerSinConexion';
import { PantallaPedido } from '../mesera/PantallaPedido';
import { FichaCuenta } from './FichaCuenta';
import { FormularioTelefonico } from './FormularioTelefonico';
import { PantallaCobro } from './PantallaCobro';
import { PantallaTablero } from './PantallaTablero';
import { PantallaTurno } from './PantallaTurno';
import { CLAVES_CAJA } from './api';

const SECCIONES = [
  { a: '', titulo: 'Cuentas abiertas' },
  { a: 'para-llevar', titulo: 'Para llevar' },
  { a: 'turno', titulo: 'Turno' },
] as const;

/**
 * Shell de caja (computadora de escritorio).
 *
 * Es la pantalla con más funciones y la que usa la persona con más soltura
 * técnica: acá sí se puede densificar la información.
 *
 * Pendiente (prompt 6): apertura y cierre de turno con horas por mesera y los
 * tres repartos lado a lado.
 */
export function CajaLayout() {
  const usuario = useSesion((s) => s.usuario);
  const cerrar = useSesion((s) => s.cerrar);
  const cliente = useQueryClient();
  const { socket, conectado } = useSocket(SalaRealtime.CAJA);

  // El tablero se mantiene al día solo: una mesera abre una cuenta o manda un
  // pedido desde el salón y acá aparece sin recargar nada.
  const refrescar = () => void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.cuentas });
  useEventoSocket(socket, EventosServidor.CUENTA_ABIERTA, refrescar);
  useEventoSocket(socket, EventosServidor.CUENTA_ACTUALIZADA, refrescar);
  useEventoSocket(socket, EventosServidor.CUENTA_COBRADA, refrescar);
  useEventoSocket(socket, EventosServidor.PEDIDO_ESTADO, refrescar);

  return (
    <div className="flex min-h-dvh flex-col">
      <BannerSinConexion conectado={conectado} />

      <header className="flex flex-wrap items-center gap-6 border-b border-slate-200/70 bg-white px-6 py-3 shadow-sm">
        <h1 className="text-lg font-bold text-marca">Caja</h1>
        <nav className="flex flex-1 gap-1">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.a}
              to={s.a}
              end={s.a === ''}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-marca-claro text-marca-oscuro' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {s.titulo}
            </NavLink>
          ))}
        </nav>
        <span className="text-sm text-slate-500">{usuario?.nombre}</span>
        <button className="boton-secundario text-sm" onClick={cerrar}>
          Salir
        </button>
      </header>

      <main className="flex flex-1 flex-col">
        <Routes>
          <Route index element={<PantallaTablero />} />
          <Route path="cuenta/:id" element={<FichaCuenta />} />
          <Route path="cuenta/:id/cobro" element={<PantallaCobro />} />
          {/* La misma pantalla que usa la mesera: tomar un pedido es el mismo
              trabajo, cambie quien lo tome. */}
          <Route path="cuenta/:id/pedido" element={<PantallaPedido base="/caja" />} />
          <Route path="para-llevar" element={<FormularioTelefonico />} />
          <Route path="turno" element={<PantallaTurno />} />
        </Routes>
      </main>
    </div>
  );
}
