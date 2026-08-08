import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { PayloadJwt } from '@brisas/shared';
import type { Request } from 'express';
import { CLAVE_PUBLICO } from './roles.decorator';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publico) return true;

    const req = ctx.switchToHttp().getRequest<Request & { usuario?: PayloadJwt }>();
    const token = this.extraerToken(req);
    if (!token) throw new UnauthorizedException('Sesión no iniciada');

    try {
      req.usuario = await this.jwt.verifyAsync<PayloadJwt>(token);
      return true;
    } catch {
      throw new UnauthorizedException('La sesión venció. Volvé a entrar con tu PIN.');
    }
  }

  private extraerToken(req: Request): string | undefined {
    const [tipo, token] = req.headers.authorization?.split(' ') ?? [];
    return tipo === 'Bearer' ? token : undefined;
  }
}
