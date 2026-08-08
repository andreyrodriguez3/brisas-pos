import { z } from 'zod';
import { Rol } from '../types/enums';
import { zColorMesera, zPin } from './comunes';

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  rol: z.nativeEnum(Rol),
  pin: zPin,
  /** El color identifica sus cuentas en las tres pantallas. */
  color_hex: zColorMesera,
});
export type CrearUsuarioDto = z.infer<typeof crearUsuarioSchema>;

export const actualizarUsuarioSchema = crearUsuarioSchema
  .partial()
  .extend({ activo: z.boolean().optional() });
export type ActualizarUsuarioDto = z.infer<typeof actualizarUsuarioSchema>;
