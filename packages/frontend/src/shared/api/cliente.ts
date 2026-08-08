import { useSesion } from '../estado/sesion';

/**
 * Cliente HTTP tipado.
 *
 * En desarrollo Vite hace proxy de /api al backend; en producción el backend
 * sirve el frontend, así que la ruta relativa apunta siempre al servidor
 * correcto sin configurar nada por dispositivo.
 */
export const BASE_API = '/api';

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly errores?: Array<{ campo: string; mensaje: string }>,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }

  /** true si se cayó la red, no el servidor. Dispara el banner SIN CONEXIÓN. */
  get esDeConexion(): boolean {
    return this.estado === 0;
  }
}

interface OpcionesPeticion extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const { body, headers, ...resto } = opciones;
  const token = useSesion.getState().token;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE_API}${ruta}`, {
      ...resto,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ErrorApi(0, 'Sin conexión con el servidor');
  }

  if (respuesta.status === 401) {
    // La sesión venció: de vuelta al login, sin pantallas rotas de por medio.
    useSesion.getState().cerrar();
    throw new ErrorApi(401, 'La sesión venció. Volvé a entrar con tu PIN.');
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    throw new ErrorApi(
      respuesta.status,
      datos.mensaje ?? datos.message ?? 'No se pudo completar la acción',
      datos.errores,
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export const api = {
  get: <T>(ruta: string) => peticion<T>(ruta),
  post: <T>(ruta: string, body?: unknown) => peticion<T>(ruta, { method: 'POST', body }),
  put: <T>(ruta: string, body?: unknown) => peticion<T>(ruta, { method: 'PUT', body }),
  patch: <T>(ruta: string, body?: unknown) => peticion<T>(ruta, { method: 'PATCH', body }),
  delete: <T>(ruta: string) => peticion<T>(ruta, { method: 'DELETE' }),
};
