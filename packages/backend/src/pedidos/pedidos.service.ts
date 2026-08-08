import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  EstadoCuenta,
  EstadoPedido,
  calcularTotalLinea,
  envasesNecesarios,
  ordenarCola,
  type CanalCuenta as TipoCanal,
  type ColaCocina,
  type ComandaCocina,
  type EditarLineaDto,
  type EnviarPedidoDto,
  type LineaNuevaDto,
} from '@brisas/shared';
import type { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfiguracionService } from '../config/configuracion.service';
import { diaLocal } from '../common/fechas';
import { CuentasService } from '../cuentas/cuentas.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/** Una línea ya validada y con sus precios congelados, lista para insertar. */
interface LineaCongelada {
  producto_id: number;
  variante_id: number;
  cantidad: number;
  precio_unit_snapshot: number;
  nota: string | null;
  para_llevar: boolean;
  es_envase: boolean;
  opciones: Array<{ opcion_id: number; nombre_snapshot: string; precio_extra_snapshot: number }>;
}

@Injectable()
export class PedidosService {
  private readonly logger = new Logger('Pedidos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfiguracionService,
    private readonly cuentas: CuentasService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── Enviar a cocina ───────────────────────────────────────────────────────

  /**
   * Manda un pedido a cocina.
   *
   * Una cuenta es un CONTENEDOR de pedidos: cada envío crea una comanda nueva e
   * independiente. Si la cuenta ya tenía pedidos, el servidor marca
   * `es_agregado` y cocina la pinta con su banda naranja AGREGADO.
   *
   * Acá es donde se CONGELAN los precios (INVARIANTE 2): se copian del menú una
   * sola vez, a `precio_unit_snapshot` y `precio_extra_snapshot`. Después de
   * esto, esta comanda no vuelve a mirar el menú nunca — si la dueña sube un
   * precio a media tarde, esta cuenta no cambia.
   */
  async enviar(dto: EnviarPedidoDto, usuarioId: number) {
    // Idempotencia: la cola offline del celular puede reintentar un envío del
    // que nunca vio la respuesta. Si ya existe esa clave, devolvemos la comanda
    // que ya se creó en vez de mandarle el pedido dos veces a la cocina.
    if (dto.idempotencia_key) {
      const yaExiste = await this.prisma.pedido.findUnique({
        where: { idempotencia_key: dto.idempotencia_key },
        select: { id: true, cuenta_id: true },
      });
      if (yaExiste) {
        this.logger.log(`Reenvío reconocido (${dto.idempotencia_key}) → pedido ${yaExiste.id}`);
        return this.cuentas.detalle(yaExiste.cuenta_id);
      }
    }

    const precioEnvase = await this.config.precioEnvase();

    const { pedidoId, cuenta, esAgregado, consecutivo } = await this.prisma.$transaction(
      async (tx) => {
        const cuenta = await tx.cuenta.findUnique({
          where: { id: dto.cuenta_id },
          include: { mesera_responsable: { select: { nombre: true, color_hex: true } } },
        });
        if (!cuenta) throw new NotFoundException('No existe esa cuenta');
        if (cuenta.estado !== EstadoCuenta.ABIERTA) {
          throw new BadRequestException(
            cuenta.estado === EstadoCuenta.ANULADA
              ? 'Esta cuenta está anulada'
              : 'Esta cuenta ya se está cobrando: no se le pueden agregar pedidos',
          );
        }

        const canal = cuenta.canal as TipoCanal;
        const lineas = await this.congelarLineas(tx, dto.lineas);

        // El envase: ₡200 por unidad. Se agrega en dos casos —
        //   · cuenta PARA_LLEVAR: uno por platillo, automático;
        //   · cliente del salón que se lleva lo que le sobró: uno por línea marcada.
        // ⚠️ Esto SOLO agrega el cargo. La comida NO cambia de totalizador:
        // eso lo decide `cuenta.canal`, y lo hace `totalizadorDeLinea`.
        const cuantosEnvases = envasesNecesarios(canal, lineas);
        if (cuantosEnvases > 0) {
          lineas.push(await this.lineaDeEnvase(tx, cuantosEnvases, precioEnvase));
        }

        const pedidosPrevios = await tx.pedido.count({ where: { cuenta_id: cuenta.id } });
        const esAgregado = pedidosPrevios > 0;

        const dia = diaLocal();
        const ultimo = await tx.pedido.findFirst({
          where: { dia },
          orderBy: { consecutivo_dia: 'desc' },
          select: { consecutivo_dia: true },
        });
        const consecutivo = (ultimo?.consecutivo_dia ?? 0) + 1;

        const pedido = await tx.pedido.create({
          data: {
            cuenta_id: cuenta.id,
            dia,
            consecutivo_dia: consecutivo,
            creado_por_id: usuarioId,
            estado: EstadoPedido.ENVIADO,
            es_agregado: esAgregado,
            idempotencia_key: dto.idempotencia_key ?? null,
            // creado_en lo pone el servidor. Un celular con la hora mal no puede
            // desordenar la cola de cocina.
            lineas: {
              create: lineas.map((l) => ({
                producto_id: l.producto_id,
                variante_id: l.variante_id,
                cantidad: l.cantidad,
                precio_unit_snapshot: l.precio_unit_snapshot,
                nota: l.nota,
                para_llevar: l.para_llevar,
                opciones: { create: l.opciones },
              })),
            },
          },
        });

        await this.auditoria.registrar(
          {
            usuario_id: usuarioId,
            accion: AccionAuditoria.PEDIDO_ENVIAR,
            cuenta_id: cuenta.id,
            pedido_id: pedido.id,
            despues: {
              consecutivo_dia: consecutivo,
              es_agregado: esAgregado,
              envases: cuantosEnvases,
              lineas: lineas.map((l) => ({
                producto_id: l.producto_id,
                cantidad: l.cantidad,
                precio_unit_snapshot: l.precio_unit_snapshot,
                para_llevar: l.para_llevar,
                nota: l.nota,
                total: calcularTotalLinea({
                  cantidad: l.cantidad,
                  precio_unit_snapshot: l.precio_unit_snapshot,
                  opciones: l.opciones,
                }),
              })),
            },
          },
          tx,
        );

        return { pedidoId: pedido.id, cuenta, esAgregado, consecutivo };
      },
    );

    this.realtime.pedidoNuevo({
      pedido_id: pedidoId,
      cuenta_id: cuenta.id,
      nombre_cliente: cuenta.nombre_cliente,
      es_agregado: esAgregado,
      canal: cuenta.canal,
      mesera_nombre: cuenta.mesera_responsable?.nombre ?? null,
      mesera_color: cuenta.mesera_responsable?.color_hex ?? null,
    });
    this.realtime.cuentaActualizada({ cuenta_id: cuenta.id });

    this.logger.log(`Comanda #${consecutivo} → cocina (cuenta ${cuenta.id})`);
    return this.cuentas.detalle(cuenta.id);
  }

  // ── La cola de cocina ─────────────────────────────────────────────────────

  /**
   * Todo lo que la tablet de cocina tiene que mostrar, en una sola llamada.
   *
   * Van las comandas del día que todavía están en juego: ENVIADO, EN_PREPARACION
   * y LISTO. Las ENTREGADO salen de la pantalla — ya no hay nada que hacer con
   * ellas y solo estorbarían. Las de cuentas anuladas tampoco aparecen: esa
   * comida no se cocina.
   *
   * No devuelve ni un precio. A la cocina no le sirven y ocuparían el lugar de
   * lo que sí importa.
   */
  async colaCocina(): Promise<ColaCocina> {
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        dia: diaLocal(),
        estado: { in: [EstadoPedido.ENVIADO, EstadoPedido.EN_PREPARACION, EstadoPedido.LISTO] },
        cuenta: { estado: { not: EstadoCuenta.ANULADA } },
      },
      include: {
        cuenta: {
          select: {
            id: true,
            nombre_cliente: true,
            referencia: true,
            canal: true,
            hora_retiro: true,
            mesera_responsable: { select: { nombre: true, color_hex: true } },
          },
        },
        lineas: {
          where: {
            anulada: false,
            // El envase no se cocina: es empaque. Mostrarlo como si fuera un
            // platillo más confundiría a la cocinera y le robaría espacio a la
            // comida de verdad. El cargo ya está en la cuenta; caja lo ve.
            producto: { es_envase: false },
          },
          orderBy: { id: 'asc' },
          include: {
            opciones: { select: { nombre_snapshot: true } },
            producto: { select: { nombre_es: true } },
            variante: { select: { etiqueta: true } },
          },
        },
      },
    });

    const comandas: ComandaCocina[] = pedidos
      // Una comanda cuyas líneas se anularon todas no tiene nada que preparar.
      .filter((p) => p.lineas.length > 0)
      .map((p) => ({
        pedido_id: p.id,
        cuenta_id: p.cuenta.id,
        consecutivo_dia: p.consecutivo_dia,
        estado: p.estado as EstadoPedido,
        es_agregado: p.es_agregado,
        nombre_cliente: p.cuenta.nombre_cliente,
        referencia: p.cuenta.referencia,
        canal: p.cuenta.canal as TipoCanal,
        hora_retiro: p.cuenta.hora_retiro?.toISOString() ?? null,
        mesera_nombre: p.cuenta.mesera_responsable?.nombre ?? null,
        mesera_color: p.cuenta.mesera_responsable?.color_hex ?? null,
        creado_en: p.creado_en.toISOString(),
        lineas: p.lineas.map((l) => ({
          id: l.id,
          cantidad: l.cantidad,
          producto_nombre: l.producto.nombre_es,
          // "Único" es la variante de relleno de los productos de un solo
          // precio: escribirla en la tarjeta sería ruido.
          variante_etiqueta: l.variante.etiqueta === 'Único' ? null : l.variante.etiqueta,
          opciones: l.opciones.map((o) => o.nombre_snapshot),
          nota: l.nota,
        })),
      }));

    return {
      // El orden lo decide `shared`: salón por hora de entrada, para llevar por
      // hora de retiro. La pantalla lo vuelve a aplicar, pero que el servidor ya
      // los mande ordenados evita que un cliente distinto invente otro criterio.
      comandas: ordenarCola(comandas),
      umbrales: await this.config.umbralesCocina(),
      // INVARIANTE 6: el reloj lo pone el servidor. La tablet mide el
      // temporizador contra esta hora, no contra la suya.
      hora_servidor: new Date().toISOString(),
    };
  }

  // ── Editar líneas ─────────────────────────────────────────────────────────

  /**
   * Editar una línea ya enviada.
   *
   * ⚠️ NO se recalcula el precio desde el menú: `precio_unit_snapshot` se queda
   * como está. Cambiar la cantidad multiplica el precio congelado, no el actual.
   */
  async editarLinea(lineaId: number, dto: EditarLineaDto, usuarioId: number) {
    const cuentaId = await this.prisma.$transaction(async (tx) => {
      const antes = await tx.pedidoLinea.findUnique({
        where: { id: lineaId },
        include: { opciones: true, pedido: { select: { cuenta_id: true } } },
      });
      if (!antes) throw new NotFoundException('No existe esa línea');
      if (antes.anulada) throw new BadRequestException('Esa línea está anulada');

      await this.exigirCuentaAbierta(tx, antes.pedido.cuenta_id);

      if (dto.opciones_ids) {
        const opciones = await this.congelarOpciones(tx, antes.producto_id, dto.opciones_ids);
        await tx.lineaOpcion.deleteMany({ where: { linea_id: lineaId } });
        await tx.lineaOpcion.createMany({
          data: opciones.map((o) => ({ linea_id: lineaId, ...o })),
        });
      }

      const despues = await tx.pedidoLinea.update({
        where: { id: lineaId },
        data: {
          ...(dto.cantidad !== undefined ? { cantidad: dto.cantidad } : {}),
          ...(dto.nota !== undefined ? { nota: dto.nota ?? null } : {}),
          ...(dto.para_llevar !== undefined ? { para_llevar: dto.para_llevar } : {}),
        },
        include: { opciones: true },
      });

      const accion =
        dto.cantidad !== undefined
          ? AccionAuditoria.LINEA_CAMBIAR_CANTIDAD
          : dto.para_llevar !== undefined
            ? AccionAuditoria.LINEA_MARCAR_PARA_LLEVAR
            : dto.opciones_ids !== undefined
              ? AccionAuditoria.LINEA_CAMBIAR_OPCIONES
              : AccionAuditoria.LINEA_CAMBIAR_NOTA;

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion,
          cuenta_id: antes.pedido.cuenta_id,
          pedido_id: antes.pedido_id,
          linea_id: lineaId,
          antes,
          despues,
        },
        tx,
      );

      return antes.pedido.cuenta_id;
    });

    // Marcar o desmarcar "para llevar" cambia cuántos envases hay que cobrar.
    await this.recalcularEnvases(cuentaId, usuarioId);

    this.realtime.cuentaActualizada({ cuenta_id: cuentaId });
    return this.cuentas.detalle(cuentaId);
  }

  /** INVARIANTE 4: la línea no se borra, queda `anulada`. */
  async anularLinea(lineaId: number, motivo: string, usuarioId: number) {
    const cuentaId = await this.prisma.$transaction(async (tx) => {
      const antes = await tx.pedidoLinea.findUnique({
        where: { id: lineaId },
        include: { pedido: { select: { cuenta_id: true } } },
      });
      if (!antes) throw new NotFoundException('No existe esa línea');

      await this.exigirCuentaAbierta(tx, antes.pedido.cuenta_id);

      const despues = await tx.pedidoLinea.update({
        where: { id: lineaId },
        data: { anulada: true },
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.LINEA_ANULAR,
          cuenta_id: antes.pedido.cuenta_id,
          pedido_id: antes.pedido_id,
          linea_id: lineaId,
          antes,
          despues,
          motivo,
        },
        tx,
      );

      return antes.pedido.cuenta_id;
    });

    await this.recalcularEnvases(cuentaId, usuarioId);
    this.realtime.cuentaActualizada({ cuenta_id: cuentaId });
    return this.cuentas.detalle(cuentaId);
  }

  // ── Estado de la comanda ──────────────────────────────────────────────────

  /**
   * Avanza (o retrocede) una comanda.
   *
   * ⚠️ Acepta ir hacia atrás a propósito: en cocina no hay diálogos de
   * confirmación, hay un botón DESHACER que dura 30 segundos. Deshacer es
   * exactamente esto — volver al estado anterior — y queda auditado igual que
   * el avance. Confirmar antes cansa; deshacer después perdona.
   */
  async cambiarEstado(
    pedidoId: number,
    estado: EstadoPedido,
    usuarioId: number,
    porNombre: string,
  ) {
    const pedido = await this.prisma.$transaction(async (tx) => {
      const antes = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: { cuenta: { select: { estado: true } } },
      });
      if (!antes) throw new NotFoundException('No existe esa comanda');
      if (antes.cuenta.estado === EstadoCuenta.ANULADA) {
        throw new BadRequestException('Esa cuenta se anuló: no hay nada que preparar');
      }

      const despues = await tx.pedido.update({ where: { id: pedidoId }, data: { estado } });
      await tx.pedidoLinea.updateMany({
        where: { pedido_id: pedidoId, anulada: false },
        data: { estado_linea: estado },
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.PEDIDO_CAMBIAR_ESTADO,
          cuenta_id: antes.cuenta_id,
          pedido_id: pedidoId,
          antes: { estado: antes.estado },
          despues: { estado },
        },
        tx,
      );
      return despues;
    });

    this.realtime.pedidoEstado({
      pedido_id: pedidoId,
      cuenta_id: pedido.cuenta_id,
      estado,
      por: porNombre,
    });
    this.realtime.cuentaActualizada({ cuenta_id: pedido.cuenta_id });
    return pedido;
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /**
   * Valida cada línea contra el menú y le congela los precios.
   *
   * Todo lo que puede estar mal se revisa acá, en el servidor: que el producto
   * se pueda vender, que la variante tenga precio, que las opciones pertenezcan
   * al producto y que los grupos obligatorios estén contestados. La interfaz ya
   * lo impide, pero esconder botones no es validación.
   */
  private async congelarLineas(
    tx: Prisma.TransactionClient,
    lineas: LineaNuevaDto[],
  ): Promise<LineaCongelada[]> {
    const congeladas: LineaCongelada[] = [];

    for (const linea of lineas) {
      const producto = await tx.producto.findUnique({
        where: { id: linea.producto_id },
        include: { variantes: true, grupos: { include: { grupo: true } } },
      });
      if (!producto) throw new BadRequestException(`El producto ${linea.producto_id} no existe`);
      if (!producto.activo) {
        throw new BadRequestException(`"${producto.nombre_es}" ya no se vende`);
      }
      if (producto.agotado) {
        throw new BadRequestException(`"${producto.nombre_es}" se agotó hoy`);
      }

      const variante = producto.variantes.find((v) => v.id === linea.variante_id);
      if (!variante) {
        throw new BadRequestException(`Esa presentación no es de "${producto.nombre_es}"`);
      }
      if (!variante.activo) {
        throw new BadRequestException(
          `"${producto.nombre_es} ${variante.etiqueta}" no está activo`,
        );
      }
      if (variante.precio_colones === null) {
        throw new BadRequestException(
          `"${producto.nombre_es}" no tiene precio cargado y no se puede vender todavía`,
        );
      }

      const opciones = await this.congelarOpciones(tx, producto.id, linea.opciones_ids);

      // Los grupos obligatorios tienen que estar contestados.
      for (const { grupo } of producto.grupos) {
        if (!grupo.obligatorio) continue;
        const elegidas = await tx.opcion.count({
          where: { id: { in: linea.opciones_ids }, grupo_opcion_id: grupo.id },
        });
        if (elegidas < grupo.min_sel) {
          throw new BadRequestException(
            `"${producto.nombre_es}" necesita que elijas ${grupo.nombre.toLowerCase()}`,
          );
        }
      }

      congeladas.push({
        producto_id: producto.id,
        variante_id: variante.id,
        cantidad: linea.cantidad,
        // ⚠️ ACÁ SE CONGELA EL PRECIO. No se vuelve a leer el menú nunca.
        precio_unit_snapshot: variante.precio_colones,
        nota: linea.nota?.trim() || null,
        para_llevar: linea.para_llevar,
        es_envase: producto.es_envase,
        opciones,
      });
    }

    return congeladas;
  }

  private async congelarOpciones(
    tx: Prisma.TransactionClient,
    productoId: number,
    opcionesIds: number[],
  ) {
    if (opcionesIds.length === 0) return [];

    const opciones = await tx.opcion.findMany({
      where: { id: { in: opcionesIds }, activo: true },
      include: { grupo: { include: { productos: { where: { producto_id: productoId } } } } },
    });

    if (opciones.length !== new Set(opcionesIds).size) {
      throw new BadRequestException('Alguna de las opciones elegidas ya no está disponible');
    }
    for (const o of opciones) {
      if (o.grupo.productos.length === 0) {
        throw new BadRequestException(`La opción "${o.nombre}" no es de este producto`);
      }
    }

    return opciones.map((o) => ({
      opcion_id: o.id,
      // Snapshots: la comanda se tiene que poder releer aunque la opción se
      // renombre o se desactive después.
      nombre_snapshot: o.nombre,
      precio_extra_snapshot: o.precio_extra,
    }));
  }

  /**
   * La línea del envase.
   *
   * El precio sale de `configuracion.PRECIO_ENVASE`, no del menú: es la clave
   * que la dueña ajusta si el envase sube. El producto del menú solo aporta las
   * llaves (producto_id / variante_id), que son obligatorias.
   */
  private async lineaDeEnvase(
    tx: Prisma.TransactionClient,
    cantidad: number,
    precio: number,
  ): Promise<LineaCongelada> {
    const envase = await tx.producto.findFirst({
      where: { es_envase: true, activo: true },
      include: { variantes: { where: { activo: true }, orderBy: { orden: 'asc' }, take: 1 } },
    });
    if (!envase || envase.variantes.length === 0) {
      throw new BadRequestException(
        'No hay un producto de envase configurado en el menú. Avisale a la dueña.',
      );
    }

    return {
      producto_id: envase.id,
      variante_id: envase.variantes[0].id,
      cantidad,
      precio_unit_snapshot: precio,
      nota: null,
      // La línea de envase no se marca `para_llevar`: no es comida que alguien
      // se lleve, es el empaque. Marcarla generaría envases del envase.
      para_llevar: false,
      es_envase: true,
      opciones: [],
    };
  }

  /**
   * Recalcula los envases de la cuenta después de marcar, desmarcar o anular.
   *
   * Se ajusta la línea de envase del ÚLTIMO pedido para no crear una comanda
   * nueva en cocina solo por un cambio de empaque — a la cocinera no le sirve
   * ver "1 envase" como comanda aparte.
   */
  private async recalcularEnvases(cuentaId: number, usuarioId: number) {
    const precioEnvase = await this.config.precioEnvase();

    await this.prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuenta.findUnique({
        where: { id: cuentaId },
        include: {
          pedidos: {
            orderBy: { creado_en: 'asc' },
            include: { lineas: { include: { producto: { select: { es_envase: true } } } } },
          },
        },
      });
      if (!cuenta || cuenta.estado !== EstadoCuenta.ABIERTA) return;

      const todas = cuenta.pedidos.flatMap((p) =>
        p.lineas.map((l) => ({
          cantidad: l.cantidad,
          para_llevar: l.para_llevar,
          es_envase: l.producto.es_envase,
          anulada: l.anulada,
        })),
      );

      const necesarios = envasesNecesarios(cuenta.canal as TipoCanal, todas);

      const lineasEnvase = cuenta.pedidos.flatMap((p) =>
        p.lineas.filter((l) => l.producto.es_envase && !l.anulada),
      );
      const actuales = lineasEnvase.reduce((n, l) => n + l.cantidad, 0);
      if (actuales === necesarios) return;

      const antes = { envases: actuales };

      if (necesarios === 0) {
        await tx.pedidoLinea.updateMany({
          where: { id: { in: lineasEnvase.map((l) => l.id) } },
          data: { anulada: true },
        });
      } else if (lineasEnvase.length > 0) {
        // Se ajusta la primera y se anulan las demás, para dejar una sola línea.
        await tx.pedidoLinea.update({
          where: { id: lineasEnvase[0].id },
          data: { cantidad: necesarios },
        });
        await tx.pedidoLinea.updateMany({
          where: { id: { in: lineasEnvase.slice(1).map((l) => l.id) } },
          data: { anulada: true },
        });
      } else {
        const ultimo = cuenta.pedidos.at(-1);
        if (!ultimo) return;
        const nueva = await this.lineaDeEnvase(tx, necesarios, precioEnvase);
        await tx.pedidoLinea.create({
          data: {
            pedido_id: ultimo.id,
            producto_id: nueva.producto_id,
            variante_id: nueva.variante_id,
            cantidad: nueva.cantidad,
            precio_unit_snapshot: nueva.precio_unit_snapshot,
            para_llevar: false,
          },
        });
      }

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.LINEA_MARCAR_PARA_LLEVAR,
          cuenta_id: cuentaId,
          antes,
          despues: { envases: necesarios },
          motivo: 'Ajuste automático del cargo de envases',
        },
        tx,
      );
    });
  }

  private async exigirCuentaAbierta(tx: Prisma.TransactionClient, cuentaId: number) {
    const cuenta = await tx.cuenta.findUnique({ where: { id: cuentaId } });
    if (!cuenta) throw new NotFoundException('No existe esa cuenta');
    if (cuenta.estado !== EstadoCuenta.ABIERTA) {
      throw new BadRequestException(
        cuenta.estado === EstadoCuenta.ANULADA
          ? 'Esta cuenta está anulada'
          : 'Esta cuenta ya se está cobrando',
      );
    }
    return cuenta;
  }
}
