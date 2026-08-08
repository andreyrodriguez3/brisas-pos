import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PayloadJwt } from '@brisas/shared';
import { Observable, tap } from 'rxjs';
import { CLAVE_AUDITAR } from './auditar.decorator';
import { AuditoriaService } from './auditoria.service';

/**
 * Red de seguridad para las mutaciones simples.
 *
 * Registra automáticamente la acción marcada con `@Auditar(...)` cuando el
 * endpoint termina bien. Sirve para mutaciones de una sola escritura (menú,
 * usuarias, configuración).
 *
 * ⚠️ NO reemplaza al servicio. Las mutaciones de cuenta, pedido y línea llaman a
 * `AuditoriaService.registrar` DENTRO de su transacción, con el antes y el
 * después reales — que es lo que la caja necesita ver en la bitácora. El
 * interceptor solo garantiza que nada quede sin rastro por olvido.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditoriaInterceptor');

  constructor(
    private readonly auditoria: AuditoriaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const accion = this.reflector.get<string | undefined>(CLAVE_AUDITAR, ctx.getHandler());
    if (!accion) return next.handle();

    const req = ctx.switchToHttp().getRequest<{
      usuario?: PayloadJwt;
      body?: unknown;
      params?: Record<string, string>;
      method: string;
      url: string;
    }>();

    return next.handle().pipe(
      tap((resultado) => {
        const usuarioId = req.usuario?.sub;
        if (!usuarioId) return;

        void this.auditoria
          .registrar({
            usuario_id: usuarioId,
            accion: accion as never,
            antes: { params: req.params, body: req.body },
            despues: resultado,
          })
          // Si la auditoría falla, se loguea fuerte pero no se le devuelve un
          // error al usuario por algo que ya se guardó.
          .catch((e) => this.logger.error(`No se pudo auditar ${accion}: ${e}`));
      }),
    );
  }
}
