import { describe, expect, it, vi } from 'vitest';
import { Rol, SalaRealtime } from '@brisas/shared';
import { RealtimeGateway } from './realtime.gateway';

describe('unirse a la sala al conectar', () => {
  it('autentica antes de unir aunque handleConnection aún no terminó', async () => {
    const payload = { sub: 2, nombre: 'Cocina', rol: Rol.COCINA };
    const jwt = { verifyAsync: vi.fn().mockResolvedValue(payload) };
    const auth = { validarSesion: vi.fn().mockResolvedValue(payload) };
    const gateway = new RealtimeGateway(jwt as never, auth as never);
    const cliente = {
      handshake: { auth: { token: 'token-de-prueba' } },
      data: {},
      id: 'socket-1',
      join: vi.fn(),
      disconnect: vi.fn(),
    };

    await expect(gateway.unirse(cliente as never, { sala: SalaRealtime.COCINA })).resolves.toEqual({
      ok: true,
      sala: SalaRealtime.COCINA,
    });
    expect(cliente.join).toHaveBeenCalledWith(SalaRealtime.COCINA);
    expect(cliente.data).toEqual({ usuario: payload });
  });
});
