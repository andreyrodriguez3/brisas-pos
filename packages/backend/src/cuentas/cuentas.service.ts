import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  CanalCuenta,
  EstadoCuenta,
  Rol,
  calcularTotalLinea,
  estadoMenosAvanzado,
  type AbrirCuentaDto,
  type AnularCuentaDto,
  type EditarCuentaDto,
  type EstadoPedido,
  type TraspasarCuentaDto,
} from '@brisas/shared';
import type { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TurnosService } from '../turnos/turnos.service';

const MESERA = { select: { id: true, nombre: true, color_hex: true } };

/**
 * Cuentas.
 *
 * El restaurante NO usa números de mesa: cada cuenta se abre con el nombre del
 * cliente. Los nombres se pueden repetir en el mismo turno — el sistema lo
 * permite y los desambigua con la hora de apertura y el color de la mesera.
 *
 * EDICIÓN CRUZADA (requisito central): cualquier mesera puede editar cualquier
 * cuenta abierta. No hay bloqueo por propietaria. Lo que sí hay es rastro: toda
 * modificación queda auditada a nombre de quien la hizo, y la responsable NO
 * cambia — para eso existe `traspasar`, que es una acción explícita y aparte.
 */
@Injectable()
export class CuentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly turnos: TurnosService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── Abrir ─────────────────────────────────────────────────────────────────

  async abrir(dto: AbrirCuentaDto, usuarioId: number, rol: Rol) {
    // Una cuenta PARA_LLEVAR normalmente la abre caja, que es quien contesta el
    // teléfono, y no tiene mesera responsable: su venta no es atribuible a nadie.
    const responsableId =
      dto.canal === CanalCuenta.PARA_LLEVAR
        ? null
        : (dto.mesera_responsable_id ?? (rol === Rol.MESERA ? usuarioId : null));

    const cuenta = await this.prisma.$transaction(async (tx) => {
      const turno = await this.turnos.turnoAbierto(usuarioId, tx);

      const creada = await tx.cuenta.create({
        data: {
          turno_id: turno.id,
          canal: dto.canal,
          nombre_cliente: dto.nombre_cliente,
          referencia: dto.referencia ?? null,
          telefono: dto.telefono ?? null,
          // hora_retiro es la ÚNICA fecha que manda el cliente: es una intención
          // ("paso a las 6"), no el registro de cuándo pasó algo.
          hora_retiro: dto.hora_retiro ? new Date(dto.hora_retiro) : null,
          mesera_responsable_id: responsableId,
          abierta_por_id: usuarioId,
          estado: EstadoCuenta.ABIERTA,
        },
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.CUENTA_ABRIR,
          cuenta_id: creada.id,
          despues: creada,
        },
        tx,
      );
      return creada;
    });

    this.realtime.cuentaAbierta({ cuenta_id: cuenta.id });
    return this.detalle(cuenta.id);
  }

  // ── Listar ────────────────────────────────────────────────────────────────

  /**
   * Cuentas del turno abierto, con lo justo para pintar la tarjeta.
   * Por defecto solo las que están en juego (abiertas o cobrándose).
   */
  async listar(filtros: { estado?: EstadoCuenta; canal?: CanalCuenta } = {}) {
    const cuentas = await this.prisma.cuenta.findMany({
      where: {
        ...(filtros.estado
          ? { estado: filtros.estado }
          : { estado: { in: [EstadoCuenta.ABIERTA, EstadoCuenta.EN_COBRO] } }),
        ...(filtros.canal ? { canal: filtros.canal } : {}),
      },
      orderBy: { abierta_en: 'desc' },
      include: {
        mesera_responsable: MESERA,
        pedidos: {
          select: {
            id: true,
            estado: true,
            lineas: {
              where: { anulada: false },
              select: {
                cantidad: true,
                precio_unit_snapshot: true,
                opciones: { select: { precio_extra_snapshot: true } },
              },
            },
          },
        },
      },
    });

    const editadas = await this.cualesFueronEditadasPorTerceros(cuentas);

    return cuentas.map((c) => ({
      ...c,
      mesera_responsable: undefined,
      mesera_nombre: c.mesera_responsable?.nombre ?? null,
      mesera_color: c.mesera_responsable?.color_hex ?? null,
      total: c.pedidos.reduce(
        (t, p) => t + p.lineas.reduce((s, l) => s + calcularTotalLinea(l), 0),
        0,
      ),
      n_pedidos: c.pedidos.length,
      estado_cocina: estadoMenosAvanzado(c.pedidos.map((p) => p.estado as EstadoPedido)),
      editada_por_terceros: editadas.has(c.id),
      pedidos: undefined,
    }));
  }

  // ── Ficha completa ────────────────────────────────────────────────────────

  async detalle(id: number) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id },
      include: {
        mesera_responsable: MESERA,
        comensales: { orderBy: { orden: 'asc' } },
        descuentos: true,
        pagos: true,
        pedidos: {
          orderBy: { creado_en: 'asc' },
          include: {
            creado_por: { select: { nombre: true } },
            lineas: {
              orderBy: { id: 'asc' },
              include: {
                opciones: true,
                producto: { select: { nombre_es: true, es_envase: true } },
                variante: { select: { etiqueta: true } },
              },
            },
          },
        },
      },
    });
    if (!cuenta) throw new NotFoundException('No existe esa cuenta');

    const pedidos = cuenta.pedidos.map((p) => {
      const lineas = p.lineas.map((l) => ({
        ...l,
        producto: undefined,
        variante: undefined,
        producto_nombre: l.producto.nombre_es,
        variante_etiqueta: l.variante.etiqueta,
        es_envase: l.producto.es_envase,
        total: calcularTotalLinea(l),
      }));
      return {
        ...p,
        creado_por: undefined,
        creado_por_nombre: p.creado_por.nombre,
        lineas,
        total: lineas.reduce((t, l) => t + l.total, 0),
      };
    });

    const total = pedidos.reduce((t, p) => t + p.total, 0);
    const pagado = cuenta.pagos.reduce((t, p) => t + p.monto, 0);

    return {
      ...cuenta,
      mesera_responsable: undefined,
      mesera_nombre: cuenta.mesera_responsable?.nombre ?? null,
      mesera_color: cuenta.mesera_responsable?.color_hex ?? null,
      pedidos,
      total,
      saldo: total - pagado,
      editada_por_terceros: await this.auditoria.editadaPorTerceros(
        cuenta.id,
        cuenta.mesera_responsable_id,
      ),
    };
  }

  // ── Editar (cruzada) ──────────────────────────────────────────────────────

  /**
   * Cualquier mesera puede editar cualquier cuenta abierta.
   * La responsable NO cambia por editar: solo `traspasar` la cambia.
   */
  async editar(id: number, dto: EditarCuentaDto, usuarioId: number) {
    const cuenta = await this.prisma.$transaction(async (tx) => {
      const antes = await this.exigirModificable(tx, id);

      const despues = await tx.cuenta.update({
        where: { id },
        data: {
          ...(dto.nombre_cliente !== undefined ? { nombre_cliente: dto.nombre_cliente } : {}),
          ...(dto.referencia !== undefined ? { referencia: dto.referencia } : {}),
          ...(dto.telefono !== undefined ? { telefono: dto.telefono } : {}),
          ...(dto.hora_retiro !== undefined
            ? { hora_retiro: dto.hora_retiro ? new Date(dto.hora_retiro) : null }
            : {}),
        },
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.CUENTA_EDITAR,
          cuenta_id: id,
          antes,
          despues,
        },
        tx,
      );
      return despues;
    });

    this.realtime.cuentaActualizada({ cuenta_id: id });
    return cuenta;
  }

  // ── Traspasar ─────────────────────────────────────────────────────────────

  /** Lo ÚNICO que cambia la mesera responsable. Explícito y auditado. */
  async traspasar(id: number, dto: TraspasarCuentaDto, usuarioId: number) {
    const cuenta = await this.prisma.$transaction(async (tx) => {
      const antes = await this.exigirModificable(tx, id);

      if (antes.canal === CanalCuenta.PARA_LLEVAR) {
        throw new BadRequestException(
          'Una cuenta para llevar no tiene mesera responsable: su venta va a la cuenta aparte de la dueña.',
        );
      }

      const nueva = await tx.usuario.findUnique({ where: { id: dto.nueva_mesera_id } });
      if (!nueva || !nueva.activo) {
        throw new BadRequestException('Esa usuaria no existe o está desactivada');
      }
      if (nueva.rol !== Rol.MESERA && nueva.rol !== Rol.CAJA && nueva.rol !== Rol.ADMIN) {
        throw new BadRequestException('Solo se puede traspasar a una mesera, a caja o a la dueña');
      }

      const despues = await tx.cuenta.update({
        where: { id },
        data: { mesera_responsable_id: dto.nueva_mesera_id },
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.CUENTA_TRASPASAR,
          cuenta_id: id,
          antes,
          despues,
          motivo: dto.motivo ?? `Traspasada a ${nueva.nombre}`,
        },
        tx,
      );
      return despues;
    });

    this.realtime.cuentaActualizada({ cuenta_id: id });
    return cuenta;
  }

  // ── Anular ────────────────────────────────────────────────────────────────

  /** INVARIANTE 4: no se borra. Queda ANULADA, con su motivo y su responsable. */
  async anular(id: number, dto: AnularCuentaDto, usuarioId: number) {
    const cuenta = await this.prisma.$transaction(async (tx) => {
      const antes = await this.exigirModificable(tx, id);

      const pagos = await tx.pago.count({ where: { cuenta_id: id } });
      if (pagos > 0) {
        throw new BadRequestException(
          'Esta cuenta ya tiene pagos registrados. Anulá los pagos primero.',
        );
      }

      const despues = await tx.cuenta.update({
        where: { id },
        data: { estado: EstadoCuenta.ANULADA, cerrada_en: new Date() },
      });
      await tx.pedidoLinea.updateMany({
        where: { pedido: { cuenta_id: id } },
        data: { anulada: true },
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.CUENTA_ANULAR,
          cuenta_id: id,
          antes,
          despues,
          motivo: dto.motivo,
        },
        tx,
      );
      return despues;
    });

    this.realtime.cuentaActualizada({ cuenta_id: id });
    return cuenta;
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /** Una cuenta cobrada o anulada ya no se toca. */
  private async exigirModificable(tx: Prisma.TransactionClient, id: number) {
    const cuenta = await tx.cuenta.findUnique({ where: { id } });
    if (!cuenta) throw new NotFoundException('No existe esa cuenta');

    if (cuenta.estado === EstadoCuenta.COBRADA) {
      throw new BadRequestException('Esta cuenta ya se cobró y no se puede modificar');
    }
    if (cuenta.estado === EstadoCuenta.ANULADA) {
      throw new BadRequestException('Esta cuenta está anulada');
    }
    return cuenta;
  }

  /**
   * Qué cuentas tocó alguien distinto a su mesera responsable.
   * En una consulta sola: con 15 cuentas abiertas, una por cuenta sería lento
   * justo en la hora pico.
   */
  private async cualesFueronEditadasPorTerceros(
    cuentas: Array<{ id: number; mesera_responsable_id: number | null }>,
  ): Promise<Set<number>> {
    const conResponsable = cuentas.filter((c) => c.mesera_responsable_id !== null);
    if (conResponsable.length === 0) return new Set();

    const registros = await this.prisma.auditoria.findMany({
      where: { cuenta_id: { in: conResponsable.map((c) => c.id) } },
      select: { cuenta_id: true, usuario_id: true },
      distinct: ['cuenta_id', 'usuario_id'],
    });

    const responsablePorCuenta = new Map(
      conResponsable.map((c) => [c.id, c.mesera_responsable_id]),
    );

    const editadas = new Set<number>();
    for (const r of registros) {
      if (r.cuenta_id !== null && r.usuario_id !== responsablePorCuenta.get(r.cuenta_id)) {
        editadas.add(r.cuenta_id);
      }
    }
    return editadas;
  }
}
