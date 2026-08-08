import type { Rol, Sesion } from '@brisas/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EstadoSesion {
  token: string | null;
  usuario: Sesion['usuario'] | null;
  abrir: (sesion: Sesion) => void;
  cerrar: () => void;
  tieneRol: (...roles: Rol[]) => boolean;
}

/**
 * Sesión persistida en localStorage.
 *
 * La mesera no debe loguearse cada rato: su token dura 30 días y la sesión
 * sobrevive a cerrar el navegador y a reiniciar el celular. La tablet de cocina
 * ni siquiera pasa por el login (ver la ruta /cocina).
 */
export const useSesion = create<EstadoSesion>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      abrir: (sesion) => set({ token: sesion.token, usuario: sesion.usuario }),
      cerrar: () => set({ token: null, usuario: null }),
      tieneRol: (...roles) => {
        const usuario = get().usuario;
        if (!usuario) return false;
        // La dueña (ADMIN) entra a todo.
        return usuario.rol === 'ADMIN' || roles.includes(usuario.rol);
      },
    }),
    { name: 'brisas-sesion' },
  ),
);
