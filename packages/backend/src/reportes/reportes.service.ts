import { Injectable } from '@nestjs/common';
import {
  EstadoCuenta,
  aplicarDescuentos,
  calcularTotalLinea,
  totalizarCuentas,
  type DesglosePorFormaPago,
  type FormaPago,
  type RangoReporteDto,
  type ReporteVentas,
  type TipoDescuento,
  type VentasPorDia,
  type VentasPorMesera,
  type VentasPorPlatillo,
} from '@brisas/shared';
import { PrismaService } from '../prisma/prisma.service';
import { aCuentaDeCierre } from '../turnos/turnos.service';
import { diaLocal } from '../common/fechas';

/**
 * Reportes de la dueña.
 *
 * Todo sale de las cuentas COBRADAS: lo abierto todavía puede cambiar y lo
 * anulado no se vendió. La separación por canal es la de siempre —por cuenta,
 * nunca por línea— y la hace `totalizarCuentas` de `shared`, la misma función
 * que usa el cierre del día. Dos formas de sumar serían dos verdades.
 */
@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async ventas(rango: RangoReporteDto): Promise<ReporteVentas> {
    const hasta = rango.hasta ?? diaLocal();
    const desde = rango.desde ?? hasta;

    const cuentas = await this.prisma.cuenta.findMany({
      where: {
        estado: EstadoCuenta.COBRADA,
        turno: { fecha: { gte: desde, lte: hasta } },
      },
      include: {
        turno: { select: { fecha: true } },
        mesera_responsable: { select: { id: true, nombre: true, color_hex: true } },
        descuentos: true,
        pagos: true,
        pedidos: {
          include: {
            lineas: {
              include: {
                opciones: { select: { precio_extra_snapshot: true } },
                producto: {
                  select: { id: true, nombre_es: true, es_envase: true, categoria_id: true },
                },
              },
            },
          },
        },
      },
    });

    const categorias = await this.prisma.categoria.findMany({ select: { id: true, nombre: true } });
    const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));

    const totalizadores = totalizarCuentas(cuentas.map(aCuentaDeCierre));

    // ── Por día ─────────────────────────────────────────────────────────────
    const porDia = new Map<string, VentasPorDia>();
    for (const cuenta of cuentas) {
      const dia = cuenta.turno.fecha;
      const fila =
        porDia.get(dia) ?? { dia, salon: 0, para_llevar: 0, envases: 0, n_cuentas: 0 };
      const t = totalizarCuentas([aCuentaDeCierre(cuenta)]);
      fila.salon += t.salon;
      fila.para_llevar += t.para_llevar;
      fila.envases += t.envases;
      fila.n_cuentas += 1;
      porDia.set(dia, fila);
    }

    // ── Por mesera: solo salón, que es lo atribuible ────────────────────────
    const porMesera = new Map<number, VentasPorMesera>();
    for (const cuenta of cuentas) {
      const mesera = cuenta.mesera_responsable;
      if (!mesera) continue;

      const fila =
        porMesera.get(mesera.id) ?? {
          usuario_id: mesera.id,
          nombre: mesera.nombre,
          color_hex: mesera.color_hex,
          ventas: 0,
          n_cuentas: 0,
        };
      fila.ventas += totalizarCuentas([aCuentaDeCierre(cuenta)]).salon;
      fila.n_cuentas += 1;
      porMesera.set(mesera.id, fila);
    }

    // ── Por platillo: qué se vende de verdad ───────────────────────────────
    const porPlatillo = new Map<number, VentasPorPlatillo>();
    for (const cuenta of cuentas) {
      for (const pedido of cuenta.pedidos) {
        for (const linea of pedido.lineas) {
          if (linea.anulada) continue;
          const p = linea.producto;
          const fila =
            porPlatillo.get(p.id) ?? {
              producto_id: p.id,
              nombre: p.nombre_es,
              categoria: nombreCategoria.get(p.categoria_id) ?? '—',
              unidades: 0,
              monto: 0,
            };
          fila.unidades += linea.cantidad;
          fila.monto += calcularTotalLinea(linea);
          porPlatillo.set(p.id, fila);
        }
      }
    }

    // ── Descuentos y formas de pago ────────────────────────────────────────
    let totalDescuentos = 0;
    const porForma = new Map<string, { monto: number; n: number }>();

    for (const cuenta of cuentas) {
      const subtotal = cuenta.pedidos.reduce(
        (t, p) => t + p.lineas.reduce((s, l) => s + calcularTotalLinea(l), 0),
        0,
      );
      totalDescuentos += aplicarDescuentos(
        subtotal,
        cuenta.descuentos.map((d) => ({ tipo: d.tipo as TipoDescuento, valor: d.valor })),
      ).descuento;

      for (const pago of cuenta.pagos) {
        const actual = porForma.get(pago.forma_pago) ?? { monto: 0, n: 0 };
        porForma.set(pago.forma_pago, { monto: actual.monto + pago.monto, n: actual.n + 1 });
      }
    }

    const formasPago: DesglosePorFormaPago[] = [...porForma.entries()].map(([forma, v]) => ({
      forma_pago: forma as FormaPago,
      monto: v.monto,
      n_pagos: v.n,
    }));

    return {
      desde,
      hasta,
      totalizadores,
      total_descuentos: totalDescuentos,
      por_dia: [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
      por_mesera: [...porMesera.values()].sort((a, b) => b.ventas - a.ventas),
      por_platillo: [...porPlatillo.values()].sort((a, b) => b.monto - a.monto),
      formas_pago: formasPago,
    };
  }

  /**
   * Salón vs. para llevar, para la cuenta aparte de la dueña.
   *
   * Es el mismo dato que ya está en `totalizadores`, expuesto aparte porque es
   * la pregunta que la dueña hace más seguido y no debería tener que buscarla
   * dentro de otro reporte.
   */
  async porCanal(rango: RangoReporteDto) {
    const reporte = await this.ventas(rango);
    const { salon, para_llevar, envases } = reporte.totalizadores;
    return {
      desde: reporte.desde,
      hasta: reporte.hasta,
      salon,
      para_llevar,
      envases,
      // Se dicen explícitos para que nadie los sume mal al leerlos.
      total: salon + para_llevar + envases,
    };
  }
}
