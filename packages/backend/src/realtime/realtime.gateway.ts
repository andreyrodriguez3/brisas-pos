import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  Rol,
  SalaRealtime,
  type PayloadCuenta,
  type PayloadJwt,
  type PayloadPedidoEstado,
  type PayloadPedidoNuevo,
  type PayloadUnirse,
} from '@brisas/shared';
import { Server, Socket } from 'socket.io';

/** A qué sala puede entrar cada rol. ADMIN entra a cualquiera (ver `puedeUnirse`). */
const SALA_POR_ROL: Partial<Record<Rol, SalaRealtime>> = {
  [Rol.COCINA]: SalaRealtime.COCINA,
  [Rol.MESERA]: SalaRealtime.MESERAS,
  [Rol.CAJA]: SalaRealtime.CAJA,
};

/**
 * Gateway de Socket.IO. Tres salas: `cocina`, `caja` y `meseras`.
 *
 * Es lo que hace que la comanda aparezca en la tablet de cocina en menos de dos
 * segundos sin que nadie recargue nada, y que el celular de la mesera avise
 * cuando su pedido pasa a LISTO.
 *
 * CORS abierto: son dispositivos de la LAN del restaurante entrando por IP.
 *
 * ⚠️ La conexión SÍ pide el mismo JWT que ya usa el REST — sin login nuevo, sin
 * que nadie tenga que registrar nada a mano: la mesera ya lo tiene desde que
 * entró con su PIN, y la tablet de cocina desde que arrancó sola. Sin esto,
 * cualquier dispositivo en la LAN podía escuchar en tiempo real cada pedido,
 * cada cuenta y cada cobro sin loguearse.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private servidor!: Server;

  private readonly logger = new Logger('Realtime');

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(cliente: Socket) {
    const token = cliente.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Conexión sin token, se cierra: ${cliente.id}`);
      cliente.disconnect(true);
      return;
    }

    try {
      const usuario = await this.jwt.verifyAsync<PayloadJwt>(token);
      cliente.data.usuario = usuario;
      this.logger.log(`Conectado ${cliente.id} (${usuario.rol})`);
    } catch {
      this.logger.warn(`Token inválido, se cierra: ${cliente.id}`);
      cliente.disconnect(true);
    }
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

    const usuario = cliente.data.usuario as PayloadJwt | undefined;
    if (!usuario || !this.puedeUnirse(usuario.rol, sala)) {
      this.logger.warn(`${cliente.id} (${usuario?.rol ?? 'sin rol'}) intentó entrar a "${sala}"`);
      return { ok: false };
    }

    void cliente.join(sala);
    this.logger.log(`${cliente.id} entró a "${sala}"`);
    return { ok: true, sala };
  }

  /** El rol de cada dispositivo solo entra a SU sala. ADMIN (la dueña) entra a cualquiera. */
  private puedeUnirse(rol: Rol, sala: SalaRealtime): boolean {
    if (rol === Rol.ADMIN) return true;
    return SALA_POR_ROL[rol] === sala;
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
