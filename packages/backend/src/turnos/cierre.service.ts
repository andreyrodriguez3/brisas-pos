import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  EstadoCuenta,
  EstadoTurno,
  aplicarDescuentos,
  calcularReparto,
  montoSegunRegla,
  totalizarCuentas,
  type CerrarTurnoDto,
  type CierreCompleto,
  type DesglosePorFormaPago,
  type FormaPago,
  type MeseraDelCierre,
  type ReglaReparto,
  type TipoDescuento,
} from '@brisas/shared';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfiguracionService } from '../config/configuracion.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { horasTrabajadas } from '../common/fechas';
import { TurnosService, aCuentaDeCierre } from './turnos.service';

/**
 * Cierre del día.
 *
 * Es un REPORTE sobre datos que el sistema ya tiene, no un motor de nómina: el
 * sistema calcula y muestra, y la entrega del dinero la hace la caja a mano.
 *
 * El cierre es **inmutable y reimprimible**. Se guarda el desglose completo del
 * cálculo en `desglose_json` —no solo los números finales— para que mañana se
 * pueda volver a mostrar exactamente igual aunque el menú, los precios o la
 * regla de reparto hayan cambiado. Y `cierre_mesera` guarda las horas y las
 * ventas CRUDAS, así que los cierres viejos se pueden recalcular si la dueña
 * cambia de regla dentro de seis meses.
 */
@Injectable()
export class CierreService {
  private readonly logger = new Logger('Cierre');

  constructor(
    private readonly prisma: PrismaService,
    private readonly turnos: TurnosService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfiguracionService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Cierra el turno y produce el cierre del día.
   *
   * No se puede cerrar con cuentas sin resolver: cerrar así dejaría comida
   * vendida fuera del cierre y la caja no cuadraría. `forzar` existe para la
   * cuenta que quedó abierta por error, y exige motivo.
   */
  async cerrar(turnoId: number, dto: CerrarTurnoDto, usuarioId: number): Promise<CierreCompleto> {
    const turno = await this.prisma.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundException('No existe ese turno');
    if (turno.estado !== EstadoTurno.ABIERTO) {
      throw new BadRequestException('Ese turno ya se cerró. Los cierres no se repiten.');
    }

    const cuentas = await this.turnos.cuentasDelTurno(turnoId);
    const sinResolver = cuentas.filter(
      (c) => c.estado === EstadoCuenta.ABIERTA || c.estado === EstadoCuenta.EN_COBRO,
    );

    if (sinResolver.length > 0 && !dto.forzar) {
      throw new BadRequestException(
        `Quedan ${sinResolver.length} cuenta(s) sin cobrar ni anular: ${sinResolver
          .map((c) => c.nombre_cliente)
          .join(', ')}. Resolvelas o confirmá el cierre forzado con un motivo.`,
      );
    }
    if (sinResolver.length > 0 && !dto.motivo?.trim()) {
      throw new BadRequestException('Para cerrar con cuentas sin resolver hace falta un motivo');
    }

    const regla = await this.config.reglaReparto();
    const desglose = await this.armarDesglose(turnoId, regla);

    const { cierreId, cerradoEn } = await this.prisma.$transaction(async (tx) => {
      const cerradoEn = new Date();

      await tx.turno.update({
        where: { id: turnoId },
        data: { estado: EstadoTurno.CERRADO, cerrado_en: cerradoEn, cerrado_por_id: usuarioId },
      });

      const cierre = await tx.cierreDia.create({
        data: {
          turno_id: turnoId,
          total_salon: desglose.total_salon,
          total_para_llevar: desglose.total_para_llevar,
          total_envases: desglose.total_envases,
          total_descuentos: desglose.total_descuentos,
          regla_aplicada: regla,
          n_meseras: desglose.meseras.length,
          // El desglose COMPLETO del cálculo, no solo el número final.
          desglose_json: JSON.stringify({ ...desglose, cerrado_en: cerradoEn.toISOString() }),
        },
      });

      // Horas y ventas crudas: permiten recalcular si la regla cambia después.
      for (const m of desglose.meseras) {
        await tx.cierreMesera.create({
          data: {
            cierre_id: cierre.id,
            usuario_id: m.usuario_id,
            horas_trabajadas: m.horas_trabajadas,
            ventas_atribuidas: m.ventas_atribuidas,
            monto_atribucion: m.monto_atribucion,
            monto_horas: m.monto_horas,
            monto_partes_iguales: m.monto_partes_iguales,
          },
        });
      }

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.TURNO_CERRAR,
          despues: {
            turno_id: turnoId,
            total_salon: desglose.total_salon,
            total_para_llevar: desglose.total_para_llevar,
            total_envases: desglose.total_envases,
            regla_aplicada: regla,
          },
          motivo: sinResolver.length > 0 ? `Cierre forzado. ${dto.motivo ?? ''}`.trim() : null,
        },
        tx,
      );

      return { cierreId: cierre.id, cerradoEn };
    });

    this.realtime.turnoCerrado(turnoId);
    this.logger.log(
      `Turno ${turnoId} cerrado — salón ${desglose.total_salon}, para llevar ${desglose.total_para_llevar}, envases ${desglose.total_envases}`,
    );

    return { ...desglose, cierre_id: cierreId, cerrado_en: cerradoEn.toISOString() };
  }

  /** Un cierre ya hecho, tal como se guardó. Reimprimible. */
  async ver(cierreId: number): Promise<CierreCompleto> {
    const cierre = await this.prisma.cierreDia.findUnique({ where: { id: cierreId } });
    if (!cierre) throw new NotFoundException('No existe ese cierre');

    // Se devuelve lo GUARDADO, no un recálculo: el cierre es un registro
    // histórico y tiene que verse igual aunque hoy los precios sean otros.
    const guardado = JSON.parse(cierre.desglose_json) as CierreCompleto;
    return { ...guardado, cierre_id: cierre.id, generado_en: cierre.generado_en.toISOString() };
  }

  async listar() {
    const cierres = await this.prisma.cierreDia.findMany({
      include: { turno: { select: { fecha: true } } },
      orderBy: { generado_en: 'desc' },
      take: 60,
    });
    return cierres.map((c) => ({
      id: c.id,
      turno_id: c.turno_id,
      fecha: c.turno.fecha,
      total_salon: c.total_salon,
      total_para_llevar: c.total_para_llevar,
      total_envases: c.total_envases,
      total_descuentos: c.total_descuentos,
      regla_aplicada: c.regla_aplicada as ReglaReparto,
      n_meseras: c.n_meseras,
      generado_en: c.generado_en.toISOString(),
    }));
  }

  /** Vista previa sin cerrar: la caja mira los números antes de decidir. */
  async previa(turnoId: number): Promise<Omit<CierreCompleto, 'cierre_id' | 'cerrado_en'>> {
    const regla = await this.config.reglaReparto();
    return this.armarDesglose(turnoId, regla);
  }

  // ── El cálculo ────────────────────────────────────────────────────────────

  private async armarDesglose(
    turnoId: number,
    regla: ReglaReparto,
  ): Promise<Omit<CierreCompleto, 'cierre_id' | 'cerrado_en'>> {
    const turno = await this.prisma.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundException('No existe ese turno');

    const todas = await this.turnos.cuentasDelTurno(turnoId);
    // Solo lo efectivamente cobrado entra a los totales. Lo anulado se reporta
    // aparte: la dueña tiene que poder ver qué se anuló y quién lo hizo.
    const cobradas = todas.filter((c) => c.estado === EstadoCuenta.COBRADA);

    const paraTotalizar = cobradas.map(aCuentaDeCierre);
    const totalizadores = totalizarCuentas(paraTotalizar);

    // Los descuentos se calculan cuenta por cuenta, con la misma función
    // encadenada que usó la caja al cobrar.
    const totalDescuentos = cobradas.reduce((acc, cuenta) => {
      const subtotal = cuenta.pedidos.reduce(
        (t, p) =>
          t +
          p.lineas.reduce(
            (s, l) =>
              s +
              (l.anulada
                ? 0
                : (l.precio_unit_snapshot +
                    l.opciones.reduce((e, o) => e + o.precio_extra_snapshot, 0)) *
                  l.cantidad),
            0,
          ),
        0,
      );
      const { descuento } = aplicarDescuentos(
        subtotal,
        cuenta.descuentos.map((d) => ({ tipo: d.tipo as TipoDescuento, valor: d.valor })),
      );
      return acc + descuento;
    }, 0);

    const registros = await this.prisma.turnoMesera.findMany({
      where: { turno_id: turnoId },
      include: { usuario: { select: { nombre: true, color_hex: true } } },
      orderBy: { hora_entrada: 'asc' },
    });

    const reparto = calcularReparto(
      paraTotalizar,
      registros.map((r) => ({
        usuario_id: r.usuario_id,
        horas: Number(horasTrabajadas(r.hora_entrada, r.hora_salida).toFixed(2)),
      })),
      regla,
    );

    const meseras: MeseraDelCierre[] = registros.map((r, i) => {
      const parte = reparto.meseras[i];
      return {
        usuario_id: r.usuario_id,
        nombre: r.usuario.nombre,
        color_hex: r.usuario.color_hex,
        hora_entrada: r.hora_entrada.toISOString(),
        hora_salida: r.hora_salida?.toISOString() ?? null,
        horas_trabajadas: parte.horas_trabajadas,
        ventas_atribuidas: parte.ventas_atribuidas,
        monto_atribucion: parte.monto_atribucion,
        monto_horas: parte.monto_horas,
        monto_partes_iguales: parte.monto_partes_iguales,
        monto_aplicado: montoSegunRegla(parte, regla),
      };
    });

    // Desglose por forma de pago: es lo que permite cuadrar la caja física.
    const porForma = new Map<string, { monto: number; n: number }>();
    for (const cuenta of cobradas) {
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

    const anuladas = todas.filter((c) => c.estado === EstadoCuenta.ANULADA);
    const quienAnulo = await this.prisma.auditoria.findMany({
      where: { cuenta_id: { in: anuladas.map((c) => c.id) }, accion: AccionAuditoria.CUENTA_ANULAR },
      include: { usuario: { select: { nombre: true } } },
    });

    return {
      turno_id: turnoId,
      fecha: turno.fecha,
      abierto_en: turno.abierto_en.toISOString(),
      generado_en: new Date().toISOString(),

      total_salon: totalizadores.salon,
      total_para_llevar: totalizadores.para_llevar,
      total_envases: totalizadores.envases,
      total_descuentos: totalDescuentos,
      total_cobrado:
        totalizadores.salon + totalizadores.para_llevar + totalizadores.envases - totalDescuentos,

      regla_aplicada: regla,
      base_reparto: reparto.base_reparto,
      meseras,

      formas_pago: formasPago,
      cuentas_anuladas: anuladas.map((c) => {
        const registro = quienAnulo.find((a) => a.cuenta_id === c.id);
        return {
          id: c.id,
          nombre_cliente: c.nombre_cliente,
          motivo: registro?.motivo ?? null,
          anulada_por: registro?.usuario.nombre ?? '—',
        };
      }),
      n_cuentas: cobradas.length,
      n_pedidos: cobradas.reduce((acc, c) => acc + c.pedidos.length, 0),
    };
  }
}
