import { describe, expect, it, vi } from 'vitest';
import { EstadoCuenta, FormaPago } from '@brisas/shared';
import { CobroService } from './cobro.service';

describe('operaciones de cobro', () => {
  it('no permite cerrar una cuenta anulada aunque el saldo sea cero', async () => {
    const tx = {
      cuenta: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({ estado: EstadoCuenta.ANULADA }),
        update: vi.fn(),
      },
    };
    const prisma = { $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx) };
    const cobro = new CobroService(prisma as never, null as never, null as never);
    await expect(cobro.cerrar(1, 1)).rejects.toThrow(/anulada/);
    expect(tx.cuenta.update).not.toHaveBeenCalled();
  });

  it('rechaza un descuento después del primer pago', async () => {
    const tx = {
      cuenta: { findUnique: vi.fn().mockResolvedValue({ estado: EstadoCuenta.EN_COBRO }) },
      pago: { count: vi.fn().mockResolvedValue(1) },
      descuento: { create: vi.fn() },
    };
    const prisma = { $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx) };
    const cobro = new CobroService(prisma as never, null as never, null as never);
    await expect(
      cobro.aplicarDescuento(1, { tipo: 'MONTO', valor: 100, motivo: 'Promoción' }, 1),
    ).rejects.toThrow(/Ya se registró un pago/);
    expect(tx.descuento.create).not.toHaveBeenCalled();
  });

  it('recalcula el saldo dentro de cada transacción concurrente', async () => {
    let estado = EstadoCuenta.ABIERTA;
    let pagado = 0;
    let cola = Promise.resolve();
    const tx = {
      cuenta: {
        updateMany: vi.fn().mockImplementation(async () => {
          if (estado === EstadoCuenta.COBRADA) return { count: 0 };
          estado = EstadoCuenta.EN_COBRO;
          return { count: 1 };
        }),
        findUnique: vi.fn().mockImplementation(async () => ({ estado })),
        update: vi.fn().mockImplementation(async ({ data }: { data: { estado: EstadoCuenta } }) => {
          estado = data.estado;
        }),
      },
      division: { findFirst: vi.fn().mockResolvedValue(null) },
      pago: {
        create: vi.fn().mockImplementation(async ({ data }: { data: { monto: number } }) => {
          pagado += data.monto;
          return { ...data, parte_num: null };
        }),
      },
    };
    const prisma = {
      $transaction: (run: (client: typeof tx) => Promise<unknown>) => {
        const anterior = cola;
        let liberar!: () => void;
        cola = new Promise<void>((resolve) => {
          liberar = resolve;
        });
        return anterior.then(() => run(tx)).finally(liberar);
      },
    };
    const auditoria = { registrar: vi.fn().mockResolvedValue(undefined) };
    const realtime = { cuentaCobrada: vi.fn(), cuentaActualizada: vi.fn() };
    const cobro = new CobroService(prisma as never, auditoria as never, realtime as never);
    vi.spyOn(cobro, 'estado').mockImplementation(async () => ({
      cuenta_id: 1,
      estado,
      modo: 'TOTAL',
      n_partes: null,
      subtotal: 100,
      descuento: 0,
      total: 100,
      pagado,
      saldo: Math.max(0, 100 - pagado),
      detalle_descuentos: [],
      partes: [],
      comensales: [],
      sin_asignar: [],
      advertencias: [],
      se_puede_cobrar: true,
    }));

    const dto = { monto: 100, forma_pago: FormaPago.EFECTIVO, parte_num: null, forzar: false };
    const resultados = await Promise.allSettled([
      cobro.registrarPago(1, dto, 1),
      cobro.registrarPago(1, dto, 1),
    ]);
    expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(tx.pago.create).toHaveBeenCalledTimes(1);
    expect(pagado).toBe(100);
  });
});
