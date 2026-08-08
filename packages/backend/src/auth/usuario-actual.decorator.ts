import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { PayloadJwt } from '@brisas/shared';

/** El usuario del JWT ya verificado por JwtGuard. */
export const UsuarioActual = createParamDecorator(
  (dato: keyof PayloadJwt | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ usuario?: PayloadJwt }>();
    const usuario = req.usuario;
    if (!usuario) return undefined;
    return dato ? usuario[dato] : usuario;
  },
);
