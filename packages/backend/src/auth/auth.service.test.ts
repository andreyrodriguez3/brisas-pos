import { describe, expect, it, vi } from 'vitest';
import { Rol, type PayloadJwt } from '@brisas/shared';
import { AuthService } from './auth.service';

const payload: PayloadJwt = { sub: 7, nombre: 'Ana', rol: Rol.CAJA };

describe('validarSesion', () => {
  it('rechaza un token de una usuaria desactivada', async () => {
    const prisma = {
      usuario: {
        findUnique: vi.fn().mockResolvedValue({ activo: false, rol: Rol.CAJA, nombre: 'Ana' }),
      },
    };
    const auth = new AuthService(prisma as never, null as never, null as never);
    await expect(auth.validarSesion(payload)).rejects.toThrow(/no está activa/);
  });

  it('rechaza el rol anterior después de cambiarlo', async () => {
    const prisma = {
      usuario: {
        findUnique: vi.fn().mockResolvedValue({ activo: true, rol: Rol.MESERA, nombre: 'Ana' }),
      },
    };
    const auth = new AuthService(prisma as never, null as never, null as never);
    await expect(auth.validarSesion(payload)).rejects.toThrow(/no está activa/);
  });

  it('acepta la usuaria activa y devuelve su nombre actual', async () => {
    const prisma = {
      usuario: {
        findUnique: vi.fn().mockResolvedValue({ activo: true, rol: Rol.CAJA, nombre: 'Ana María' }),
      },
    };
    const auth = new AuthService(prisma as never, null as never, null as never);
    await expect(auth.validarSesion(payload)).resolves.toEqual({ ...payload, nombre: 'Ana María' });
  });
});
