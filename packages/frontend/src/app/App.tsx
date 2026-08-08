import { Rol } from '@brisas/shared';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../roles/admin/AdminLayout';
import { CajaLayout } from '../roles/caja/CajaLayout';
import { CocinaLayout } from '../roles/cocina/CocinaLayout';
import { MeseraLayout } from '../roles/mesera/MeseraLayout';
import { useSesion } from '../shared/estado/sesion';
import { GuardRol } from './GuardRol';
import { Login } from './Login';
import { rutaInicialPorRol } from './rutas';

export function App() {
  const usuario = useSesion((s) => s.usuario);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/*
        Cocina NO tiene guard de rol ni pasa por el login.
        Son varias cocineras frente a una sola tablet en modo kiosco: pedirles
        login sería fricción pura y terminarían dejando abierta la sesión de una
        sola persona. La tablet obtiene su token sola al arrancar.
      */}
      <Route path="/cocina/*" element={<CocinaLayout />} />

      <Route element={<GuardRol roles={[Rol.MESERA, Rol.CAJA]} />}>
        <Route path="/mesera/*" element={<MeseraLayout />} />
      </Route>

      <Route element={<GuardRol roles={[Rol.CAJA]} />}>
        <Route path="/caja/*" element={<CajaLayout />} />
      </Route>

      <Route element={<GuardRol roles={[Rol.ADMIN]} />}>
        <Route path="/admin/*" element={<AdminLayout />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={usuario ? rutaInicialPorRol(usuario.rol) : '/login'} replace />}
      />
    </Routes>
  );
}
