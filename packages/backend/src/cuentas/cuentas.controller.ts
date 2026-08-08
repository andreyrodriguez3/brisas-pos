import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import {
  CanalCuenta,
  EstadoCuenta,
  Rol,
  abrirCuentaSchema,
  anularCuentaSchema,
  editarCuentaSchema,
  traspasarCuentaSchema,
  type AbrirCuentaDto,
  type AnularCuentaDto,
  type EditarCuentaDto,
  type PayloadJwt,
  type TraspasarCuentaDto,
} from '@brisas/shared';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CuentasService } from './cuentas.service';

/**
 * Cuentas.
 *
 * Sin `@Auditar`: CuentasService audita explícitamente el antes y el después
 * reales dentro de cada transacción, que es lo que la bitácora de la ficha tiene
 * que poder mostrar.
 *
 * Ojo con los permisos: editar NO pide ser la responsable. Esa es la regla —
 * cualquier mesera puede editar cualquier cuenta abierta. Anular sí es de caja
 * o admin.
 *
 * ⚠️ `@Roles(MESERA, CAJA)` a nivel de clase deja AFUERA a COCINA, y eso es
 * deliberado. El token de la tablet se emite sin PIN (`POST /auth/cocina` es
 * público, porque la tablet arranca sola en modo kiosco) y dura un año: si no
 * se acotara, cualquiera conectado al WiFi del restaurante podría pedirlo y
 * abrir, editar o traspasar cuentas. La cocina solo necesita ver comandas y
 * cambiarles el estado, y eso es exactamente lo único que puede hacer.
 */
@Controller('cuentas')
@Roles(Rol.MESERA, Rol.CAJA)
export class CuentasController {
  constructor(private readonly cuentas: CuentasService) {}

  @Get()
  listar(@Query('estado') estado?: EstadoCuenta, @Query('canal') canal?: CanalCuenta) {
    return this.cuentas.listar({ estado, canal });
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.cuentas.detalle(id);
  }

  @Post()
  abrir(
    @Body(new ZodValidationPipe(abrirCuentaSchema)) dto: AbrirCuentaDto,
    @UsuarioActual() usuario: PayloadJwt,
  ) {
    return this.cuentas.abrir(dto, usuario.sub, usuario.rol);
  }

  /** Edición cruzada: no se valida propiedad, se audita quién tocó qué. */
  @Put(':id')
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(editarCuentaSchema)) dto: EditarCuentaDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.cuentas.editar(id, dto, usuarioId);
  }

  /** Acción explícita y aparte. Es lo único que cambia la responsable. */
  @Post(':id/traspasar')
  traspasar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(traspasarCuentaSchema)) dto: TraspasarCuentaDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.cuentas.traspasar(id, dto, usuarioId);
  }

  @Post(':id/anular')
  @Roles(Rol.CAJA, Rol.ADMIN)
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(anularCuentaSchema)) dto: AnularCuentaDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.cuentas.anular(id, dto, usuarioId);
  }
}
