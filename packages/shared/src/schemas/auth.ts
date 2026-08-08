import { z } from 'zod';
import { Rol } from '../types/enums';
import { zColorMesera, zId, zPin } from './comunes';

export const loginSchema = z.object({
  usuario_id: zId,
  pin: zPin,
});
export type LoginDto = z.infer<typeof loginSchema>;

/** Lo que devuelve el login. El PIN hasheado nunca sale del backend. */
export const sesionSchema = z.object({
  token: z.string(),
  usuario: z.object({
    id: zId,
    nombre: z.string(),
    rol: z.nativeEnum(Rol),
    color_hex: zColorMesera.or(z.string()),
  }),
});
export type Sesion = z.infer<typeof sesionSchema>;

/** Contenido del JWT. `sub` es el id de usuario. */
export interface PayloadJwt {
  sub: number;
  nombre: string;
  rol: Rol;
}
