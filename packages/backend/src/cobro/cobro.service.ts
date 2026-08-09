import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  EstadoCuenta,
  EstadoPedido,
  ModoDivision,
  TipoDescuento,
  calcularTotalLinea,
  dividirEnPartes,
  formatearColones,
  repartirLinea,
  repartirPorPesos,
  resumirCobro,
  type AplicarDescuentoDto,
  type AsignarLineasDto,
  type ComensalConTotal,
  type Colones,
  type EstadoCobro,
  type FijarDivisionDto,
  type GuardarComensalesDto,
  type LineaPendienteAsignar,
  type ParteCobro,
  type RegistrarPagoDto,
} from '@brisas/shared';
import type { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/**
 * Cobro, descuentos y división de factura.
 *
 * ⚠️ El sistema NO procesa cobros. Calcula el monto y deja registrado qué se
 * cobró y con qué forma de pago; el datáfono, el SINPE y el efectivo siguen
 * funcionando aparte, igual que hoy. `forma_pago` es dato informativo.
 *
 * Ninguna aritmética de dinero se escribe acá: todo sale de `shared/money`, que
 * es la misma que corre en la pantalla de caja. El saldo que ve la cajera es
 * exactamente el que este servicio usa para decidir si la cuenta quedó saldada.
 */
@Injectable()
export class CobroService {
  private readonly logger = new Logger('Cobro');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── El estado de cobro ────────────────────────────────────────────────────

  async estado(cuentaId: number): Promise<EstadoCobro> {
    const cuenta = await this.cargar(cuentaId);

    const lineas = cuenta.pedidos.flatMap((p) =>
      p.lineas
        .filter((l) => !l.anulada)
        .map((l) => ({
          id: l.id,
          total: calcularTotalLinea(l),
          descripcion: `${l.cantidad}× ${l.producto.nombre_es}`,
          comensales: l.comensales,
        })),
    );

    const subtotal = lineas.reduce((acc, l) => acc + l.total, 0);
    const resumen = resumirCobro(
      subtotal,
      cuenta.descuentos.map((d) => ({ tipo: d.tipo as TipoDescuento, valor: d.valor })),
      cuenta.pagos,
    );

    const division = cuenta.divisiones[0];
    const modo = (division?.modo as ModoDivision | undefined) ?? ModoDivision.TOTAL;
    const nPartes = division?.n_partes ?? null;

    // Lo que le toca a cada comensal, línea por línea. El redondeo se resuelve
    // en cada línea, nunca al final: así la suma cuadra exacta.
    const porComensal = new Map<number, { total: Colones; lineas: ComensalConTotal['lineas'] }>();
    for (const c of cuenta.comensales) porComensal.set(c.id, { total: 0, lineas: [] });

    for (const linea of lineas) {
      if (linea.comensales.length === 0) continue;
      const montos = repartirLinea(
        linea.total,
        linea.comensales.map((lc) => ({ comensal_id: lc.comensal_id, fraccion: lc.fraccion })),
      );
      // En la base se guarda la fracción; la pantalla razona en "partes"
      // ("2 cervezas para Juan, 1 para Ana"). Se reconstruyen dividiendo por la
      // fracción más chica: 2/3 y 1/3 vuelven a ser 2 y 1.
      const menor = Math.min(...linea.comensales.map((lc) => lc.fraccion));

      linea.comensales.forEach((lc, i) => {
        const acumulado = porComensal.get(lc.comensal_id);
        if (!acumulado) return;
        acumulado.total += montos[i];
        acumulado.lineas.push({
          linea_id: linea.id,
          partes: menor > 0 ? Math.max(1, Math.round(lc.fraccion / menor)) : 1,
          monto: montos[i],
        });
      });
    }

    const comensales: ComensalConTotal[] = cuenta.comensales.map((c) => ({
      id: c.id,
      cuenta_id: c.cuenta_id,
      etiqueta: c.etiqueta,
      orden: c.orden,
      total: porComensal.get(c.id)?.total ?? 0,
      lineas: porComensal.get(c.id)?.lineas ?? [],
    }));

    const sinAsignar: LineaPendienteAsignar[] = lineas
      .filter((l) => l.comensales.length === 0)
      .map((l) => ({ linea_id: l.id, descripcion: l.descripcion, total: l.total }));

    const partes = this.calcularPartes(modo, nPartes, resumen.total, comensales, cuenta.pagos);

    // Advertencias: avisan, no bloquean. La caja decide y el forzado se audita.
    const advertencias: string[] = [];
    const sinEntregar = cuenta.pedidos.filter((p) => p.estado !== EstadoPedido.ENTREGADO).length;
    if (sinEntregar > 0) {
      advertencias.push(
        sinEntregar === 1
          ? 'Cocina todavía no entregó 1 comanda de esta cuenta'
          : `Cocina todavía no entregó ${sinEntregar} comandas de esta cuenta`,
      );
    }
    if (modo === ModoDivision.POR_CONSUMO && sinAsignar.length > 0) {
      advertencias.push(
        sinAsignar.length === 1
          ? 'Queda 1 línea sin asignar a un comensal'
          : `Quedan ${sinAsignar.length} líneas sin asignar a un comensal`,
      );
    }

    return {
      cuenta_id: cuenta.id,
      estado: cuenta.estado as EstadoCuenta,
      modo,
      n_partes: nPartes,
      subtotal: resumen.subtotal,
      descuento: resumen.descuento,
      total: resumen.total,
      pagado: resumen.pagado,
      saldo: resumen.saldo,
      detalle_descuentos: resumen.detalleDescuentos,
      partes,
      comensales,
      sin_asignar: sinAsignar,
      advertencias,
      // Lo único que BLOQUEA es cobrar por consumo con líneas sueltas: se
      // cobraría de menos y no se notaría hasta el cierre del día.
      se_puede_cobrar: !(modo === ModoDivision.POR_CONSUMO && sinAsignar.length > 0),
    };
  }

  /**
   * En cuántas partes se cobra y cuánto vale cada una.
   *
   * El descuento ya está aplicado sobre el total, así que las partes se calculan
   * sobre el NETO: si la dueña hace un 10 % a la cuenta, el 10 % lo reciben
   * todos, no el primero que paga.
   */
  private calcularPartes(
    modo: ModoDivision,
    nPartes: number | null,
    total: Colones,
    comensales: ComensalConTotal[],
    pagos: ReadonlyArray<{ monto: number; parte_num: number | null }>,
  ): ParteCobro[] {
    const pagadoDe = (numero: number) =>
      pagos
        // Un pago sin parte se cuenta en la primera: es el caso de "todo junto".
        .filter((p) => (p.parte_num ?? 1) === numero)
        .reduce((acc, p) => acc + p.monto, 0);

    const armar = (montos: Colones[], etiqueta: (i: number) => string): ParteCobro[] =>
      montos.map((monto, i) => {
        const pagado = pagadoDe(i + 1);
        return {
          numero: i + 1,
          etiqueta: etiqueta(i),
          monto,
          pagado,
          saldo: Math.max(0, monto - pagado),
        };
      });

    if (modo === ModoDivision.PARTES_IGUALES && nPartes && nPartes > 1) {
      // El sobrante va a la PRIMERA parte, y la pantalla muestra el desglose
      // completo (₡8.334 / ₡8.333 / ₡8.333). Nadie hace cuentas mentales.
      return armar(dividirEnPartes(total, nPartes), (i) => `Parte ${i + 1} de ${nPartes}`);
    }

    if (modo === ModoDivision.POR_CONSUMO && comensales.length > 0) {
      // Los totales por comensal son sobre el subtotal; el neto puede ser menor
      // por un descuento. Se reparte el neto en proporción a lo que consumió
      // cada uno, con enteros que suman exactamente el neto.
      const montos = repartirPorPesos(
        total,
        comensales.map((c) => c.total),
      );
      return armar(montos, (i) => comensales[i].etiqueta);
    }

    return armar([total], () => 'Total');
  }

  // ── Descuentos y cortesías ────────────────────────────────────────────────

  /** Motivo obligatorio, siempre, y auditado. Lo exige el schema Zod. */
  async aplicarDescuento(cuentaId: number, dto: AplicarDescuentoDto, usuarioId: number) {
    await this.prisma.$transaction(async (tx) => {
      const cuenta = await this.exigirCobrable(tx, cuentaId);

      const creado = await tx.descuento.create({
        data: {
          cuenta_id: cuentaId,
          tipo: dto.tipo,
          valor: dto.tipo === TipoDescuento.CORTESIA ? 0 : dto.valor,
          motivo: dto.motivo,
          autorizado_por_id: usuarioId,
        },
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.DESCUENTO_APLICAR,
          cuenta_id: cuentaId,
          antes: { estado: cuenta.estado },
          despues: { tipo: creado.tipo, valor: creado.valor },
          motivo: dto.motivo,
        },
        tx,
      );
    });

    this.realtime.cuentaActualizada({ cuenta_id: cuentaId });
    return this.estado(cuentaId);
  }

  // ── División ──────────────────────────────────────────────────────────────

  async fijarDivision(cuentaId: number, dto: FijarDivisionDto, usuarioId: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.exigirCobrable(tx, cuentaId);
      await this.exigirSinPagos(tx, cuentaId);

      const previa = await tx.division.findFirst({ where: { cuenta_id: cuentaId } });
      const datos = { modo: dto.modo, n_partes: dto.n_partes ?? null };

      const despues = previa
        ? await tx.division.update({ where: { id: previa.id }, data: datos })
        : await tx.division.create({ data: { cuenta_id: cuentaId, ...datos } });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.CUENTA_COBRAR,
          cuenta_id: cuentaId,
          antes: previa ? { modo: previa.modo, n_partes: previa.n_partes } : null,
          despues: { modo: despues.modo, n_partes: despues.n_partes },
          motivo: 'Se cambió la forma de dividir la cuenta',
        },
        tx,
      );
    });

    return this.estado(cuentaId);
  }

  /** Con `id` se renombra el comensal; sin `id` se crea. Los que no vengan, se borran. */
  async guardarComensales(cuentaId: number, dto: GuardarComensalesDto, usuarioId: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.exigirCobrable(tx, cuentaId);
      await this.exigirSinPagos(tx, cuentaId);

      const conservados: number[] = [];
      for (const [indice, c] of dto.comensales.entries()) {
        if (c.id !== undefined) {
          const actualizado = await tx.comensal.update({
            where: { id: c.id, cuenta_id: cuentaId },
            data: { etiqueta: c.etiqueta, orden: indice },
          });
          conservados.push(actualizado.id);
        } else {
          const creado = await tx.comensal.create({
            data: { cuenta_id: cuentaId, etiqueta: c.etiqueta, orden: indice },
          });
          conservados.push(creado.id);
        }
      }

      // Los comensales SÍ se borran, a diferencia del resto del sistema: son un
      // apunte de trabajo de la caja mientras se cobra, no un dato del negocio.
      // Sus asignaciones se van con ellos (onDelete: Cascade) y las líneas
      // vuelven a quedar sin asignar, que es justo lo que hay que ver.
      await tx.comensal.deleteMany({
        where: { cuenta_id: cuentaId, id: { notIn: conservados } },
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.CUENTA_COBRAR,
          cuenta_id: cuentaId,
          despues: { comensales: dto.comensales.map((c) => c.etiqueta) },
          motivo: 'Se armaron los comensales para dividir la cuenta',
        },
        tx,
      );
    });

    return this.estado(cuentaId);
  }

  /**
   * Asigna líneas a comensales.
   *
   * El cliente manda **partes enteras**, no fracciones: "2 para Juan, 1 para
   * Ana". La fracción la calcula el servidor dividiendo por la suma, así tres
   * pantallas distintas no pueden mandar 0,33 y dejar la línea sin cobrar del
   * todo.
   */
  async asignarLineas(cuentaId: number, dto: AsignarLineasDto, usuarioId: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.exigirCobrable(tx, cuentaId);
      await this.exigirSinPagos(tx, cuentaId);

      const comensales = await tx.comensal.findMany({
        where: { cuenta_id: cuentaId },
        select: { id: true },
      });
      const validos = new Set(comensales.map((c) => c.id));

      for (const asignacion of dto.asignaciones) {
        const linea = await tx.pedidoLinea.findFirst({
          where: { id: asignacion.linea_id, pedido: { cuenta_id: cuentaId } },
          select: { id: true, anulada: true },
        });
        if (!linea) {
          throw new BadRequestException(`La línea ${asignacion.linea_id} no es de esta cuenta`);
        }
        if (linea.anulada) {
          throw new BadRequestException('Una línea anulada no se le cobra a nadie');
        }

        for (const c of asignacion.comensales) {
          if (!validos.has(c.comensal_id)) {
            throw new BadRequestException('Ese comensal no es de esta cuenta');
          }
        }

        await tx.lineaComensal.deleteMany({ where: { linea_id: asignacion.linea_id } });

        const totalPartes = asignacion.comensales.reduce((acc, c) => acc + c.partes, 0);
        if (totalPartes > 0) {
          await tx.lineaComensal.createMany({
            data: asignacion.comensales.map((c) => ({
              linea_id: asignacion.linea_id,
              comensal_id: c.comensal_id,
              fraccion: c.partes / totalPartes,
            })),
          });
        }
      }

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.CUENTA_COBRAR,
          cuenta_id: cuentaId,
          despues: { asignadas: dto.asignaciones.length },
          motivo: 'Se asignaron líneas a los comensales',
        },
        tx,
      );
    });

    return this.estado(cuentaId);
  }

  // ── Pagos ─────────────────────────────────────────────────────────────────

  /**
   * Registra un pago. Puede ser parcial: la cuenta queda EN_COBRO con el saldo
   * a la vista hasta completarse, y se cierra sola cuando no queda nada.
   */
  async registrarPago(cuentaId: number, dto: RegistrarPagoDto, usuarioId: number) {
    const antes = await this.estado(cuentaId);

    if (antes.estado === EstadoCuenta.COBRADA) {
      throw new BadRequestException('Esta cuenta ya se cobró');
    }
    if (antes.estado === EstadoCuenta.ANULADA) {
      throw new BadRequestException('Esta cuenta está anulada');
    }
    if (!antes.se_puede_cobrar) {
      throw new BadRequestException(
        `No se puede cobrar todavía: quedan ${antes.sin_asignar.length} línea(s) sin asignar a un comensal`,
      );
    }
    if (antes.saldo === 0) {
      throw new BadRequestException('Esta cuenta no tiene saldo pendiente');
    }
    if (dto.monto > antes.saldo) {
      throw new BadRequestException(
        `El pago es mayor que el saldo (${formatearColones(antes.saldo)}). Revisá el monto.`,
      );
    }

    // Cocina sin entregar avisa pero no bloquea: la caja puede forzarlo, y el
    // forzado queda auditado con su motivo.
    const sinEntregar = antes.advertencias.find((a) => a.startsWith('Cocina'));
    if (sinEntregar && !dto.forzar) {
      throw new BadRequestException(`${sinEntregar}. Confirmá que querés cobrar igual.`);
    }

    const { saldada } = await this.prisma.$transaction(async (tx) => {
      const division = await tx.division.findFirst({ where: { cuenta_id: cuentaId } });

      const pago = await tx.pago.create({
        data: {
          cuenta_id: cuentaId,
          division_id: division?.id ?? null,
          parte_num: dto.parte_num ?? null,
          monto: dto.monto,
          // Informativo. El sistema no procesa ningún cobro.
          forma_pago: dto.forma_pago,
          registrado_por_id: usuarioId,
        },
      });

      const saldada = dto.monto >= antes.saldo;

      await tx.cuenta.update({
        where: { id: cuentaId },
        data: saldada
          ? { estado: EstadoCuenta.COBRADA, cerrada_en: new Date() }
          : { estado: EstadoCuenta.EN_COBRO },
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.PAGO_REGISTRAR,
          cuenta_id: cuentaId,
          antes: { saldo: antes.saldo, estado: antes.estado },
          despues: {
            monto: pago.monto,
            forma_pago: pago.forma_pago,
            parte_num: pago.parte_num,
            saldo: antes.saldo - dto.monto,
            estado: saldada ? EstadoCuenta.COBRADA : EstadoCuenta.EN_COBRO,
          },
          motivo: dto.forzar
            ? `Cobrado con comandas sin entregar. ${dto.motivo ?? ''}`.trim()
            : (dto.motivo ?? null),
        },
        tx,
      );

      return { saldada };
    });

    if (saldada) this.realtime.cuentaCobrada({ cuenta_id: cuentaId });
    else this.realtime.cuentaActualizada({ cuenta_id: cuentaId });

    this.logger.log(
      `Pago ${formatearColones(dto.monto)} en cuenta ${cuentaId}${saldada ? ' — saldada' : ''}`,
    );
    return this.estado(cuentaId);
  }

  /**
   * Cierra una cuenta que ya no debe nada.
   *
   * Existe para la CORTESÍA: si la casa invita, el total queda en cero y no hay
   * ningún pago que registrar — sin esto la cuenta se quedaría abierta para
   * siempre.
   */
  async cerrar(cuentaId: number, usuarioId: number) {
    const estado = await this.estado(cuentaId);

    if (estado.estado === EstadoCuenta.COBRADA) {
      throw new BadRequestException('Esta cuenta ya se cobró');
    }
    if (estado.saldo > 0) {
      throw new BadRequestException(
        `Todavía falta cobrar ${formatearColones(estado.saldo)}. Registrá el pago.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cuenta.update({
        where: { id: cuentaId },
        data: { estado: EstadoCuenta.COBRADA, cerrada_en: new Date() },
      });
      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.CUENTA_COBRAR,
          cuenta_id: cuentaId,
          antes: { estado: estado.estado, saldo: estado.saldo },
          despues: { estado: EstadoCuenta.COBRADA },
          motivo: estado.descuento > 0 ? 'Cerrada sin saldo (descuento o cortesía)' : 'Cerrada sin saldo',
        },
        tx,
      );
    });

    this.realtime.cuentaCobrada({ cuenta_id: cuentaId });
    return this.estado(cuentaId);
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private async cargar(cuentaId: number) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: cuentaId },
      include: {
        descuentos: { orderBy: { creado_en: 'asc' } },
        pagos: { orderBy: { creado_en: 'asc' } },
        comensales: { orderBy: { orden: 'asc' } },
        // Una cuenta tiene a lo sumo una división; la relación es de lista
        // porque el esquema no lo restringe. Se usa la última que se fijó.
        divisiones: { orderBy: { id: 'desc' }, take: 1 },
        pedidos: {
          orderBy: { creado_en: 'asc' },
          include: {
            lineas: {
              orderBy: { id: 'asc' },
              include: {
                opciones: true,
                comensales: true,
                producto: { select: { nombre_es: true, es_envase: true } },
              },
            },
          },
        },
      },
    });
    if (!cuenta) throw new NotFoundException('No existe esa cuenta');
    return cuenta;
  }

  /** Una cuenta cobrada o anulada ya no se toca. */
  private async exigirCobrable(tx: Prisma.TransactionClient, cuentaId: number) {
    const cuenta = await tx.cuenta.findUnique({ where: { id: cuentaId } });
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
   * Nada de cambiar la modalidad, los comensales o a quién le toca cada línea
   * después de que ya se registró un pago.
   *
   * `pago.parte_num` es un ÍNDICE POSICIONAL (1, 2, 3…), no una referencia al
   * comensal. Si se cambia la modalidad o se reordena/agrega/quita un
   * comensal después de cobrar, un pago viejo queda re-atribuido por
   * posición a un comensal distinto del que pagó — la suma de "pagado" por
   * comensal deja de cuadrar con el saldo real, y `registrarPago` puede
   * terminar cerrando la cuenta entera aunque a otro comensal le falte por
   * pagar. Si hace falta corregir la asignación, primero hay que anular el
   * pago.
   */
  private async exigirSinPagos(tx: Prisma.TransactionClient, cuentaId: number) {
    const pagos = await tx.pago.count({ where: { cuenta_id: cuentaId } });
    if (pagos > 0) {
      throw new BadRequestException(
        'Ya se registró un pago en esta cuenta; no se puede cambiar cómo se divide. Si hace falta corregir la asignación, anulá el pago primero.',
      );
    }
  }
}
