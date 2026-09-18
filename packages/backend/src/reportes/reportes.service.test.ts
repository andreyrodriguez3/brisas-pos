import { describe, expect, it, vi } from 'vitest';
import { ReportesService } from './reportes.service';

describe('ReportesService', () => {
  it('no calcula descuentos sobre líneas anuladas', async () => {
    const producto = { id: 1, nombre_es: 'Plato', es_envase: false, categoria_id: 1 };
    const linea = (precio: number, anulada: boolean) => ({
      cantidad: 1,
      precio_unit_snapshot: precio,
      anulada,
      opciones: [],
      producto,
    });
    const cuenta = {
      canal: 'SALON',
      mesera_responsable_id: null,
      mesera_responsable: null,
      turno: { fecha: '2026-09-18' },
      pedidos: [{ lineas: [linea(1000, false), linea(9000, true)] }],
      descuentos: [{ tipo: 'PORCENTAJE', valor: 10 }],
      pagos: [],
    };
    const prisma = {
      cuenta: { findMany: vi.fn().mockResolvedValue([cuenta]) },
      categoria: { findMany: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Comida' }]) },
    };

    const reporte = await new ReportesService(prisma as never).ventas({
      desde: '2026-09-18',
      hasta: '2026-09-18',
    });

    expect(reporte.total_descuentos).toBe(100);
    expect(reporte.por_platillo).toHaveLength(1);
    expect(reporte.por_platillo[0].monto).toBe(1000);
  });
});
