import { Rol } from '@brisas/shared';

/** A dónde cae cada rol después de entrar. */
export function rutaInicialPorRol(rol: Rol): string {
  switch (rol) {
    case Rol.MESERA:
      return '/mesera';
    case Rol.CAJA:
      return '/caja';
    case Rol.ADMIN:
      return '/admin';
    case Rol.COCINA:
      return '/cocina';
  }
}
