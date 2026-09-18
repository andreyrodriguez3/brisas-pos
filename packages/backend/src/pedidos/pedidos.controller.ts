import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import {
  cambiarEstadoLineaSchema,
  cambiarEstadoPedidoSchema,
  editarLineaSchema,
  enviarPedidoSchema,
  anularCuentaSchema,
  type AnularCuentaDto,
  type CambiarEstadoLineaDto,
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
   * Avanzar o retroceder LA COMANDA ENTERA — todas sus líneas de una vez.
   *
   * Ya no es lo que usa la tablet de cocina (eso es `lineas/:id/estado`, acá
   * abajo): esto queda para cuando la mesera recoge todo el pedido junto y lo
   * marca ENTREGADO en un solo toque, y para lo que caja resuelve al cobrar.
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

  /**
   * Avanzar o retroceder UN PLATILLO.
   *
   * Esto es lo que toca la tablet de cocina: con varias cocineras repartiendo
   * el trabajo, cada platillo avanza por su cuenta, sin esperar al resto de
   * la comanda. La mesera también puede tocarlo (llevárselo apenas está listo,
   * sin esperar a que salga todo junto).
   */
  @Patch('lineas/:id/estado')
  @Roles(Rol.COCINA, Rol.MESERA, Rol.CAJA)
  cambiarEstadoLinea(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(cambiarEstadoLineaSchema)) dto: CambiarEstadoLineaDto,
    @UsuarioActual() usuario: PayloadJwt,
  ) {
    return this.pedidos.cambiarEstadoLinea(id, dto.estado, usuario.sub, usuario.nombre);
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
