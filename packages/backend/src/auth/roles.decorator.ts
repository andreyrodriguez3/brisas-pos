import { SetMetadata } from '@nestjs/common';
import type { Rol } from '@brisas/shared';

export const CLAVE_ROLES = 'roles';

/**
 * Restringe un endpoint a ciertos roles.
 *
 * El permiso se valida SIEMPRE en el backend, no escondiendo botones en la
 * interfaz: cualquiera en la LAN puede llamar la API con curl.
 *
 *   @Roles('CAJA', 'ADMIN')
 *   @Post(':id/anular')
 */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

export const CLAVE_PUBLICO = 'publico';

/** Endpoint sin token. Solo login, health y la pantalla de cocina. */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);
