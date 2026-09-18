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
  type PayloadLineaEstado,
  type PayloadPedidoEstado,
  type PayloadPedidoNuevo,
  type PayloadUnirse,
} from '@brisas/shared';
import { Server, Socket } from 'socket.io';
import { esOrigenLan, origenCorsLan } from '../common/origen-lan';
import { AuthService } from '../auth/auth.service';

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
 * Solo admite orígenes de la LAN, igual que la API REST.
 *
 * ⚠️ La conexión SÍ pide el mismo JWT que ya usa el REST — sin login nuevo, sin
 * que nadie tenga que registrar nada a mano: la mesera ya lo tiene desde que
 * entró con su PIN, y la tablet de cocina desde que arrancó sola. Sin esto,
 * cualquier dispositivo en la LAN podía escuchar en tiempo real cada pedido,
 * cada cuenta y cada cobro sin loguearse.
 */
@WebSocketGateway({
  cors: { origin: origenCorsLan, credentials: true },
  // CORS solo protege polling; validar también el handshake de WebSocket.
  allowRequest: (req, callback) => callback(null, esOrigenLan(req.headers.origin)),
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private servidor!: Server;

  private readonly logger = new Logger('Realtime');

  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async handleConnection(cliente: Socket) {
    const token = cliente.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Conexión sin token, se cierra: ${cliente.id}`);
      cliente.disconnect(true);
      return;
    }

    try {
      const usuario = await this.auth.validarSesion(await this.jwt.verifyAsync<PayloadJwt>(token));
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
  async unirse(@ConnectedSocket() cliente: Socket, @MessageBody() payload: PayloadUnirse) {
    const sala = payload?.sala;
    if (!Object.values(SalaRealtime).includes(sala)) {
      this.logger.warn(`Sala desconocida: ${sala}`);
      return { ok: false };
    }

    // El navegador envía UNIRSE en cuanto recibe `connect`. La verificación
    // asíncrona de handleConnection puede seguir en curso en ese momento;
    // sin esta segunda ruta se pierde la sala hasta la próxima reconexión.
    let usuario = cliente.data.usuario as PayloadJwt | undefined;
    try {
      if (!usuario) {
        const token = cliente.handshake.auth?.token as string | undefined;
        if (!token) throw new Error('Falta token');
        usuario = await this.auth.validarSesion(await this.jwt.verifyAsync<PayloadJwt>(token));
        cliente.data.usuario = usuario;
      } else {
        usuario = await this.auth.validarSesion(usuario);
      }
    } catch {
      cliente.disconnect(true);
      return { ok: false };
    }
    if (!this.puedeUnirse(usuario.rol, sala)) {
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

  /** Cierra salas ya abiertas cuando admin desactiva o cambia el rol. */
  desconectarUsuario(usuarioId: number): void {
    for (const cliente of this.servidor.sockets.sockets.values()) {
      if ((cliente.data.usuario as PayloadJwt | undefined)?.sub === usuarioId) {
        cliente.disconnect(true);
      }
    }
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

  /**
   * Cambio de estado de UN platillo. Va a las tres salas igual que
   * `pedidoEstado` — el filtro de "es para mí" (mesera responsable) lo hace
   * cada celular con `mesera_responsable_id`, no el servidor: todas las
   * meseras ya comparten la sala `meseras`, tal como comparten la edición
   * cruzada de cuentas.
   */
  lineaEstado(payload: PayloadLineaEstado) {
    this.aTodos(EventosServidor.LINEA_ESTADO, payload);
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
