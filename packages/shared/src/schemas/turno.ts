import { z } from 'zod';
import { AccionAuditoria } from '../types/enums';
import { zFechaISO, zId, zMotivo } from './comunes';

/**
 * Turnos y cierre del día.
 *
 * ⚠️ Nota sobre INVARIANTE 6 (las horas las pone el servidor): `hora_entrada` y
 * `hora_salida` son la SEGUNDA excepción deliberada, junto con `hora_retiro`.
 * No son el registro de cuándo pasó algo en el sistema: son un dato que la caja
 * afirma sobre el mundo real —"María entró a las 11, aunque yo abro el turno
 * ahora a las 11:30"—. Si no se mandan, las pone el servidor. Cuando se mandan,
 * quedan auditadas con el nombre de quien las escribió.
 */

const meseraDelTurno = z.object({
  usuario_id: zId,
  /** Si no viene, entra ahora. */
  hora_entrada: zFechaISO.optional().nullable(),
});

export const abrirTurnoSchema = z.object({
  /** Se puede abrir sin nadie y ir agregando: el turno igual necesita existir. */
  meseras: z.array(meseraDelTurno).max(20).default([]),
});
export type AbrirTurnoDto = z.infer<typeof abrirTurnoSchema>;

/** Alta a mitad de turno: entra una mesera que no estaba. */
export const agregarMeseraSchema = meseraDelTurno;
export type AgregarMeseraDto = z.infer<typeof agregarMeseraSchema>;

/** Baja a mitad de turno: se va antes de que cierre el día. */
export const marcarSalidaSchema = z.object({
  hora_salida: zFechaISO.optional().nullable(),
});
export type MarcarSalidaDto = z.infer<typeof marcarSalidaSchema>;

/**
 * Cerrar el día.
 *
 * No se puede cerrar con cuentas sin resolver. `forzar` existe para el caso real
 * —una cuenta que quedó abierta por error y nadie la va a cobrar— y obliga a
 * dar un motivo, que queda en la bitácora.
 */
export const cerrarTurnoSchema = z.object({
  forzar: z.boolean().default(false),
  motivo: z.string().trim().max(200).optional(),
});
export type CerrarTurnoDto = z.infer<typeof cerrarTurnoSchema>;

/** Filtros del visor de auditoría. Todos opcionales y combinables. */
export const filtroAuditoriaSchema = z.object({
  desde: zFechaISO.optional(),
  hasta: zFechaISO.optional(),
  usuario_id: z.coerce.number().int().positive().optional(),
  accion: z.nativeEnum(AccionAuditoria).optional(),
  cuenta_id: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().min(1).max(500).default(200),
  /** Cursor para "Cargar más": trae registros más viejos que este id. */
  antes_de_id: z.coerce.number().int().positive().optional(),
});
export type FiltroAuditoriaDto = z.infer<typeof filtroAuditoriaSchema>;

/** Rango de fechas de los reportes. Días locales, YYYY-MM-DD. */
export const rangoReporteSchema = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional(),
});
export type RangoReporteDto = z.infer<typeof rangoReporteSchema>;

/** Lo usa el cierre forzado para exigir explicación. */
export const motivoObligatorioSchema = z.object({ motivo: zMotivo });
