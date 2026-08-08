import { useQueryClient } from '@tanstack/react-query';
import { ErrorApi } from '../../shared/api/cliente';

/** Claves de React Query del panel, en un solo lugar. */
export const CLAVES = {
  menuAdmin: ['menu', 'admin'] as const,
  menu: ['menu'] as const,
  gruposOpcion: ['menu', 'grupos-opcion'] as const,
  usuarias: ['usuarios', 'todas'] as const,
  paleta: ['usuarios', 'paleta'] as const,
  configuracion: ['configuracion'] as const,
};

/**
 * Invalida todo lo que depende del menú.
 * El catálogo de mesera y caja se recarga solo por Socket.IO (`menu:actualizado`),
 * pero el panel necesita refrescar su propia vista, que trae además lo
 * desactivado y lo que no tiene precio.
 */
export function useRefrescarMenu() {
  const cliente = useQueryClient();
  return () => {
    void cliente.invalidateQueries({ queryKey: CLAVES.menu });
    void cliente.invalidateQueries({ queryKey: CLAVES.gruposOpcion });
  };
}

export function useRefrescarUsuarias() {
  const cliente = useQueryClient();
  return () => {
    void cliente.invalidateQueries({ queryKey: ['usuarios'] });
  };
}

/** Mensaje legible de un error de la API, incluyendo los detalles de Zod. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorApi) {
    if (error.esDeConexion) {
      return 'Sin conexión con el servidor. Revisá que la computadora de caja esté encendida.';
    }
    if (error.errores?.length) {
      return error.errores.map((e) => e.mensaje).join('. ');
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'No se pudo completar la acción';
}
