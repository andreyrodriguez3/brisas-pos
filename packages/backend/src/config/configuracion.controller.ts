import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { AccionAuditoria, Rol, claveConfigSchema, valorConfigSchema } from '@brisas/shared';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../auth/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ConfiguracionService } from './configuracion.service';

@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly config: ConfiguracionService) {}

  /** Todas las claves. Cocina lee de acá sus umbrales de tiempo. */
  @Get()
  todas() {
    return this.config.todas();
  }

  @Put(':clave')
  @Roles(Rol.ADMIN)
  @Auditar(AccionAuditoria.CONFIG_EDITAR)
  async establecer(
    @Param('clave', new ZodValidationPipe(claveConfigSchema)) clave: string,
    @Body('valor', new ZodValidationPipe(valorConfigSchema)) valor: string,
  ) {
    await this.config.establecer(clave, valor);
    return { ok: true, clave, valor };
  }
}
