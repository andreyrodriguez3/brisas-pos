import { z } from 'zod';
import { CanalCuenta } from '../types/enums';
import { zFechaISO, zId, zMotivo, zTelefono } from './comunes';

/**
 * Abrir una cuenta.
 *
 * El restaurante NO usa números de mesa: la cuenta se identifica por el nombre
 * del cliente. Puede haber nombres repetidos en el mismo turno — el sistema los
 * permite y los desambigua con la hora de apertura y el color de la mesera.
 *
 * `canal` se fija acá y NO cambia después. Es lo único que clasifica ingresos.
 */
export const abrirCuentaSchema = z
  .object({
    canal: z.nativeEnum(CanalCuenta).default(CanalCuenta.SALON),
    nombre_cliente: z.string().trim().min(2, 'El nombre del cliente es obligatorio').max(60),
    /** "terraza", "4 personas". Opcional, ayuda a desambiguar. */
    referencia: z.string().trim().max(60).optional().nullable(),
    telefono: zTelefono.optional().nullable(),
    hora_retiro: zFechaISO.optional().nullable(),
    /** Se omite en PARA_LLEVAR: normalmente la abre caja, que contesta el teléfono. */
    mesera_responsable_id: zId.optional().nullable(),
  })
  .superRefine((datos, ctx) => {
    if (datos.canal !== CanalCuenta.PARA_LLEVAR) return;
    if (!datos.telefono) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['telefono'],
        message: 'Un pedido para llevar necesita teléfono',
      });
    }
    if (!datos.hora_retiro) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hora_retiro'],
        message: 'Un pedido para llevar necesita hora de retiro — ordena la cola de cocina',
      });
    }
  });
export type AbrirCuentaDto = z.infer<typeof abrirCuentaSchema>;

/**
 * Editar una cuenta. `canal` NO está: se fija al abrir y no cambia nunca.
 * Cualquier mesera puede editar cualquier cuenta abierta; el cambio se audita
 * a nombre de quien lo hizo, y la responsable no cambia.
 */
export const editarCuentaSchema = z.object({
  nombre_cliente: z.string().trim().min(2).max(60).optional(),
  referencia: z.string().trim().max(60).optional().nullable(),
  telefono: zTelefono.optional().nullable(),
  hora_retiro: zFechaISO.optional().nullable(),
});
export type EditarCuentaDto = z.infer<typeof editarCuentaSchema>;

/** Acción explícita y aparte. Es lo ÚNICO que cambia la mesera responsable. */
export const traspasarCuentaSchema = z.object({
  nueva_mesera_id: zId,
  motivo: zMotivo.optional(),
});
export type TraspasarCuentaDto = z.infer<typeof traspasarCuentaSchema>;

export const anularCuentaSchema = z.object({ motivo: zMotivo });
export type AnularCuentaDto = z.infer<typeof anularCuentaSchema>;
