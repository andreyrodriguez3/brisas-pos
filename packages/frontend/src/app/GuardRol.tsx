import type { Rol } from '@brisas/shared';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../shared/estado/sesion';
import { rutaInicialPorRol } from './rutas';

/**
 * Guard de ruta por rol.
 *
 * ⚠️ Esto es solo comodidad de navegación. El permiso REAL lo valida el backend
 * en cada endpoint: cualquiera en la LAN puede llamar la API sin pasar por acá.
 */
export function GuardRol({ roles }: { roles: Rol[] }) {
  const { token, usuario } = useSesion();
  const ubicacion = useLocation();

  if (!token || !usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }

  // La dueña (ADMIN) entra a todo.
  if (usuario.rol !== 'ADMIN' && !roles.includes(usuario.rol)) {
    return <Navigate to={rutaInicialPorRol(usuario.rol)} replace />;
  }

  return <Outlet />;
}
