import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol, type PayloadJwt } from '@brisas/shared';
import { CLAVE_ROLES } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!requeridos || requeridos.length === 0) return true;

    const { usuario } = ctx.switchToHttp().getRequest<{ usuario?: PayloadJwt }>();
    if (!usuario) throw new ForbiddenException('Sesión no iniciada');

    // ADMIN (la dueña) puede todo lo de los demás roles.
    if (usuario.rol === Rol.ADMIN) return true;

    if (!requeridos.includes(usuario.rol)) {
      throw new ForbiddenException('Tu usuario no tiene permiso para esta acción');
    }
    return true;
  }
}
