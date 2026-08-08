import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  Rol,
  filtroAuditoriaSchema,
  type AuditoriaConUsuario,
  type FiltroAuditoriaDto,
} from '@brisas/shared';
import { Roles } from '../auth/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuditoriaService } from './auditoria.service';

/** Un registro de la base, con su usuario, listo para viajar como JSON. */
type RegistroConUsuario = {
  creado_en: Date;
  usuario: { nombre: string; color_hex: string };
} & Record<string, unknown>;

/**
 * Visor de la bitácora.
 *
 * INVARIANTE 5: `auditoria` es APPEND-ONLY. Este controlador tiene un solo
 * verbo, `GET`, y así debe quedarse. No agregués PUT, PATCH ni DELETE — no
 * existen en el servicio y no deben existir: una bitácora que se puede editar
 * no sirve para resolver una discusión sobre quién tocó una cuenta.
 *
 * La leen caja y la dueña, que son quienes tienen que responder esa pregunta.
 */
@Controller('auditoria')
@Roles(Rol.CAJA)
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  /** Filtrable por fecha, usuaria, acción y cuenta. Todo combinable. */
  @Get()
  @Roles(Rol.ADMIN)
  async buscar(
    @Query(new ZodValidationPipe(filtroAuditoriaSchema)) filtro: FiltroAuditoriaDto,
  ): Promise<AuditoriaConUsuario[]> {
    return this.paraJson(await this.auditoria.buscar(filtro));
  }

  /** Todo lo que le pasó a una cuenta, en orden. El desplegable de la ficha. */
  @Get('cuenta/:id')
  async deCuenta(@Param('id', ParseIntPipe) id: number): Promise<AuditoriaConUsuario[]> {
    return this.paraJson(await this.auditoria.deCuenta(id));
  }

  private paraJson(registros: RegistroConUsuario[]): AuditoriaConUsuario[] {
    return registros.map((r) => {
      const { usuario, ...resto } = r;
      return {
        ...resto,
        usuario_nombre: usuario.nombre,
        usuario_color: usuario.color_hex,
        creado_en: r.creado_en.toISOString(),
      };
    }) as unknown as AuditoriaConUsuario[];
  }
}
