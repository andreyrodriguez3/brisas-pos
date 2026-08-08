import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { AccionAuditoria, Rol } from '@brisas/shared';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../auth/roles.decorator';
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
  async establecer(@Param('clave') clave: string, @Body('valor') valor: string) {
    await this.config.establecer(clave, String(valor));
    return { ok: true, clave, valor };
  }
}
