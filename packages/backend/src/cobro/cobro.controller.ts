import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import {
  Rol,
  aplicarDescuentoSchema,
  asignarLineasSchema,
  fijarDivisionSchema,
  guardarComensalesSchema,
  registrarPagoSchema,
  type AplicarDescuentoDto,
  type AsignarLineasDto,
  type FijarDivisionDto,
  type GuardarComensalesDto,
  type RegistrarPagoDto,
} from '@brisas/shared';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CobroService } from './cobro.service';

/**
 * Cobro de una cuenta.
 *
 * Todo el controlador pide rol CAJA (ADMIN, que es la dueña, pasa siempre por
 * el `RolesGuard`). Cobrar, descontar y dividir no son cosas de la mesera —
 * y esconder el botón en la interfaz no es seguridad: cualquiera en la LAN
 * puede llamar la API con curl.
 */
@Controller('cuentas/:id/cobro')
@Roles(Rol.CAJA)
export class CobroController {
  constructor(private readonly cobro: CobroService) {}

  /** Todo lo que la pantalla de cobro necesita, ya calculado. */
  @Get()
  estado(@Param('id', ParseIntPipe) id: number) {
    return this.cobro.estado(id);
  }

  /** Todo junto · partes iguales · cada quien lo suyo. */
  @Put('division')
  fijarDivision(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(fijarDivisionSchema)) dto: FijarDivisionDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.cobro.fijarDivision(id, dto, usuarioId);
  }

  @Put('comensales')
  guardarComensales(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(guardarComensalesSchema)) dto: GuardarComensalesDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.cobro.guardarComensales(id, dto, usuarioId);
  }

  @Put('asignaciones')
  asignarLineas(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(asignarLineasSchema)) dto: AsignarLineasDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.cobro.asignarLineas(id, dto, usuarioId);
  }

  /** Descuentos y cortesías. El motivo es obligatorio y queda auditado. */
  @Post('descuentos')
  aplicarDescuento(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(aplicarDescuentoSchema)) dto: AplicarDescuentoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.cobro.aplicarDescuento(id, dto, usuarioId);
  }

  /** Puede ser parcial. La cuenta se cierra sola cuando no queda saldo. */
  @Post('pagos')
  registrarPago(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(registrarPagoSchema)) dto: RegistrarPagoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.cobro.registrarPago(id, dto, usuarioId);
  }

  /** Para la cortesía: total en cero, no hay pago que registrar. */
  @Post('cerrar')
  cerrar(@Param('id', ParseIntPipe) id: number, @UsuarioActual('sub') usuarioId: number) {
    return this.cobro.cerrar(id, usuarioId);
  }
}
