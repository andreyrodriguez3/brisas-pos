import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import {
  cambiarEstadoPedidoSchema,
  editarLineaSchema,
  enviarPedidoSchema,
  anularCuentaSchema,
  type AnularCuentaDto,
  type CambiarEstadoPedidoDto,
  type EditarLineaDto,
  type EnviarPedidoDto,
  type PayloadJwt,
  Rol,
} from '@brisas/shared';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PedidosService } from './pedidos.service';

/**
 * Pedidos.
 *
 * Los permisos están por endpoint y no a nivel de clase porque acá conviven dos
 * mundos: quien TOMA pedidos (mesera y caja) y quien los COCINA (la tablet).
 *
 * ⚠️ El token de cocina se emite sin PIN y dura un año — la tablet arranca sola
 * en modo kiosco. Por eso solo alcanza para lo que la cocina realmente hace:
 * leer la cola y mover el estado de una comanda. Crear pedidos o tocar líneas
 * no está a su alcance.
 */
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  /**
   * Mandar un pedido a cocina.
   *
   * Mesera y caja: la edición cruzada es la regla, y caja también toma los
   * pedidos telefónicos. Devuelve la cuenta completa para que la pantalla se
   * refresque de una.
   */
  @Post()
  @Roles(Rol.MESERA, Rol.CAJA)
  enviar(
    @Body(new ZodValidationPipe(enviarPedidoSchema)) dto: EnviarPedidoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.pedidos.enviar(dto, usuarioId);
  }

  /** La cola de cocina: comandas del día en juego, umbrales y hora del servidor. */
  @Get('cocina')
  @Roles(Rol.COCINA, Rol.CAJA)
  cola() {
    return this.pedidos.colaCocina();
  }

  /**
   * Avanzar o retroceder una comanda.
   *
   * Cocina la mueve con un toque; la mesera marca ENTREGADO cuando lleva el
   * plato, y caja resuelve lo que quede pendiente al cobrar.
   */
  @Patch(':id/estado')
  @Roles(Rol.COCINA, Rol.MESERA, Rol.CAJA)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(cambiarEstadoPedidoSchema)) dto: CambiarEstadoPedidoDto,
    @UsuarioActual() usuario: PayloadJwt,
  ) {
    return this.pedidos.cambiarEstado(id, dto.estado, usuario.sub, usuario.nombre);
  }

  @Patch('lineas/:id')
  @Roles(Rol.MESERA, Rol.CAJA)
  editarLinea(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(editarLineaSchema)) dto: EditarLineaDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.pedidos.editarLinea(id, dto, usuarioId);
  }

  /** No se borra: queda anulada, con su motivo y quién la anuló. */
  @Patch('lineas/:id/anular')
  @Roles(Rol.MESERA, Rol.CAJA)
  anularLinea(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(anularCuentaSchema)) dto: AnularCuentaDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.pedidos.anularLinea(id, dto.motivo, usuarioId);
  }
}
