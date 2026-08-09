import { z } from 'zod';
import { CLAVES_CONFIG } from '../constants/configuracion';

/**
 * Validación de `PUT /configuracion/:clave`.
 *
 * Es el único endpoint de escritura del backend que tomaba `clave` y `valor`
 * como strings libres, sin pasar por `ZodValidationPipe`. `clave` queda
 * restringida a las que el sistema realmente conoce; un nombre inventado no
 * llega ni a tocar la base.
 */
const claves = Object.values(CLAVES_CONFIG) as [string, ...string[]];
export const claveConfigSchema = z.enum(claves);

export const valorConfigSchema = z.string().trim().min(1, 'El valor no puede quedar vacío').max(200);
