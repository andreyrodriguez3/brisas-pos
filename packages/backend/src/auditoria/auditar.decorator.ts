import { SetMetadata } from '@nestjs/common';
import type { AccionAuditoria } from '@brisas/shared';

export const CLAVE_AUDITAR = 'auditar';

/** Marca un endpoint para que AuditoriaInterceptor registre su acción. */
export const Auditar = (accion: AccionAuditoria) => SetMetadata(CLAVE_AUDITAR, accion);
