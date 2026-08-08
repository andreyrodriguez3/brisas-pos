import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  EventosCliente,
  EventosServidor,
  SalaRealtime,
  type PayloadCuenta,
  type PayloadPedidoEstado,
  type PayloadPedidoNuevo,
  type PayloadUnirse,
} from '@brisas/shared';
import { Server, Socket } from 'socket.io';

/**
 * Gateway de Socket.IO. Tres salas: `cocina`, `caja` y `meseras`.
 *
 * Es lo que hace que la comanda aparezca en la tablet de cocina en menos de dos
 * segundos sin que nadie recargue nada, y que el celular de la mesera avise
 * cuando su pedido pasa a LISTO.
 *
 * CORS abierto: son dispositivos de la LAN del restaurante entrando por IP.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private servidor!: Server;

  private readonly logger = new Logger('Realtime');

  handleConnection(cliente: Socket) {
    this.logger.log(`Conectado ${cliente.id}`);
  }

  handleDisconnect(cliente: Socket) {
    this.logger.log(`Desconectado ${cliente.id}`);
  }

  @SubscribeMessage(EventosCliente.UNIRSE)
  unirse(@ConnectedSocket() cliente: Socket, @MessageBody() { sala }: PayloadUnirse) {
    if (!Object.values(SalaRealtime).includes(sala)) {
      this.logger.warn(`Sala desconocida: ${sala}`);
      return { ok: false };
    }
    void cliente.join(sala);
    this.logger.log(`${cliente.id} entró a "${sala}"`);
    return { ok: true, sala };
  }

  @SubscribeMessage(EventosCliente.SALIR)
  salir(@ConnectedSocket() cliente: Socket, @MessageBody() { sala }: PayloadUnirse) {
    void cliente.leave(sala);
    return { ok: true };
  }

  // ── Emisores. El resto del backend habla con el realtime solo por acá ─────

  /** Comanda nueva. Cocina suena la campana y parpadea la tarjeta. */
  pedidoNuevo(payload: PayloadPedidoNuevo) {
    this.servidor.to(SalaRealtime.COCINA).emit(EventosServidor.PEDIDO_NUEVO, payload);
    this.servidor.to(SalaRealtime.CAJA).emit(EventosServidor.PEDIDO_NUEVO, payload);
  }

  /** Cambio de estado de una comanda. Va a las tres salas. */
  pedidoEstado(payload: PayloadPedidoEstado) {
    this.aTodos(EventosServidor.PEDIDO_ESTADO, payload);
  }

  cuentaAbierta(payload: PayloadCuenta) {
    this.aTodos(EventosServidor.CUENTA_ABIERTA, payload);
  }

  cuentaActualizada(payload: PayloadCuenta) {
    this.aTodos(EventosServidor.CUENTA_ACTUALIZADA, payload);
  }

  cuentaCobrada(payload: PayloadCuenta) {
    this.aTodos(EventosServidor.CUENTA_COBRADA, payload);
  }

  /** El menú cambió: las apps recargan su caché de productos. */
  menuActualizado() {
    this.aTodos(EventosServidor.MENU_ACTUALIZADO, {});
  }

  turnoAbierto(turnoId: number) {
    this.aTodos(EventosServidor.TURNO_ABIERTO, { turno_id: turnoId });
  }

  turnoCerrado(turnoId: number) {
    this.aTodos(EventosServidor.TURNO_CERRADO, { turno_id: turnoId });
  }

  private aTodos(evento: string, payload: unknown) {
    for (const sala of Object.values(SalaRealtime)) {
      this.servidor.to(sala).emit(evento, payload);
    }
  }
}
