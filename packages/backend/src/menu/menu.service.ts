import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  type ActualizarCategoriaDto,
  type ActualizarGrupoOpcionDto,
  type ActualizarProductoDto,
  type CrearCategoriaDto,
  type CrearGrupoOpcionDto,
  type CrearProductoDto,
} from '@brisas/shared';
import type { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/**
 * Menú.
 *
 * ⚠️ Cambiar un precio acá NO afecta cuentas ya abiertas. Las líneas guardan
 * `precio_unit_snapshot` y jamás se recalculan desde estas tablas (INVARIANTE 2).
 * Por eso subir un precio a media tarde es seguro: lo que ya se pidió se cobra
 * al precio que tenía cuando se pidió.
 *
 * INVARIANTE 4: nada se borra. Se desactiva.
 *
 * Toda mutación se audita con el ANTES y el DESPUÉS reales, no con el body de la
 * petición: cuando la dueña pregunte "¿quién le subió el precio al casado y de
 * cuánto a cuánto?", la bitácora tiene que poder contestar.
 */
@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Lectura ───────────────────────────────────────────────────────────────

  /**
   * El catálogo que consumen mesera y caja para armar pedidos.
   * Solo lo vendible: categorías y productos activos, con al menos un precio.
   */
  async catalogo() {
    const categorias = await this.prisma.categoria.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        productos: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
          include: {
            variantes: {
              where: { activo: true, precio_colones: { not: null } },
              orderBy: { orden: 'asc' },
            },
            grupos: { include: { grupo: { include: { opciones: { where: { activo: true } } } } } },
          },
        },
      },
    });

    return categorias.map((cat) => ({
      ...cat,
      productos: cat.productos
        .filter((p) => p.variantes.length > 0)
        .map(({ grupos, ...p }) => ({ ...p, grupos_opcion: grupos.map((g) => g.grupo) })),
    }));
  }

  /** Vista completa para el panel de admin: incluye lo desactivado y sin precio. */
  async catalogoAdmin() {
    const categorias = await this.prisma.categoria.findMany({
      orderBy: { orden: 'asc' },
      include: {
        productos: {
          orderBy: { orden: 'asc' },
          include: {
            variantes: { orderBy: { orden: 'asc' } },
            grupos: { select: { grupo_opcion_id: true } },
          },
        },
      },
    });

    return categorias.map((cat) => ({
      ...cat,
      productos: cat.productos.map(({ grupos, ...p }) => ({
        ...p,
        grupos_opcion_ids: grupos.map((g) => g.grupo_opcion_id),
        /** Sin ningún precio cargado no se puede vender, aunque esté activo. */
        vendible: p.activo && !p.agotado && p.variantes.some((v) => v.precio_colones !== null),
      })),
    }));
  }

  async producto(id: number) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: {
        variantes: { orderBy: { orden: 'asc' } },
        grupos: { select: { grupo_opcion_id: true } },
      },
    });
    if (!producto) throw new NotFoundException('No existe ese producto');

    const { grupos, ...resto } = producto;
    return { ...resto, grupos_opcion_ids: grupos.map((g) => g.grupo_opcion_id) };
  }

  // ── Categorías ────────────────────────────────────────────────────────────

  async crearCategoria(dto: CrearCategoriaDto, usuarioId: number) {
    const categoria = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.categoria.create({ data: dto });
      await this.auditoria.registrar(
        { usuario_id: usuarioId, accion: AccionAuditoria.MENU_EDITAR, despues: creada },
        tx,
      );
      return creada;
    });

    this.realtime.menuActualizado();
    return categoria;
  }

  async actualizarCategoria(id: number, dto: ActualizarCategoriaDto, usuarioId: number) {
    const categoria = await this.prisma.$transaction(async (tx) => {
      const antes = await tx.categoria.findUnique({ where: { id } });
      if (!antes) throw new NotFoundException('No existe esa categoría');

      const despues = await tx.categoria.update({ where: { id }, data: dto });
      await this.auditoria.registrar(
        { usuario_id: usuarioId, accion: AccionAuditoria.MENU_EDITAR, antes, despues },
        tx,
      );
      return despues;
    });

    this.realtime.menuActualizado();
    return categoria;
  }

  // ── Productos ─────────────────────────────────────────────────────────────

  async crearProducto(dto: CrearProductoDto, usuarioId: number) {
    const { variantes, grupos_opcion_ids, ...datos } = dto;

    const id = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({
        data: {
          ...datos,
          variantes: {
            create: variantes.map((v, i) => ({
              etiqueta: v.etiqueta,
              precio_colones: v.precio_colones,
              orden: v.orden ?? i,
              activo: v.activo ?? v.precio_colones !== null,
            })),
          },
        },
      });

      if (grupos_opcion_ids.length > 0) {
        await tx.productoGrupo.createMany({
          data: grupos_opcion_ids.map((gid) => ({
            producto_id: creado.id,
            grupo_opcion_id: gid,
          })),
        });
      }

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.MENU_EDITAR,
          despues: await this.instantanea(tx, creado.id),
        },
        tx,
      );
      return creado.id;
    });

    this.realtime.menuActualizado();
    return this.producto(id);
  }

  async actualizarProducto(id: number, dto: ActualizarProductoDto, usuarioId: number) {
    const { variantes, grupos_opcion_ids, ...datos } = dto;

    await this.prisma.$transaction(async (tx) => {
      const antes = await this.instantanea(tx, id);
      if (!antes) throw new NotFoundException('No existe ese producto');

      await tx.producto.update({ where: { id }, data: datos });

      if (variantes) {
        const conservadas: number[] = [];

        for (const [i, v] of variantes.entries()) {
          const datos = {
            etiqueta: v.etiqueta,
            precio_colones: v.precio_colones,
            orden: v.orden ?? i,
            activo: v.activo ?? v.precio_colones !== null,
          };

          if (v.id !== undefined) {
            // Viene con id: es una variante que ya existe. Se actualiza por id,
            // así cambiar la etiqueta la RENOMBRA en vez de crear otra.
            const actualizada = await tx.variante.update({
              where: { id: v.id, producto_id: id },
              data: datos,
            });
            conservadas.push(actualizada.id);
          } else {
            const creada = await tx.variante.upsert({
              where: { producto_id_etiqueta: { producto_id: id, etiqueta: v.etiqueta } },
              update: datos,
              create: { producto_id: id, ...datos },
            });
            conservadas.push(creada.id);
          }
        }

        // Una variante que ya no está en la lista se DESACTIVA, no se borra:
        // puede haber líneas ya cobradas que la referencian, y borrarla
        // rompería el historial (INVARIANTE 4).
        await tx.variante.updateMany({
          where: { producto_id: id, id: { notIn: conservadas } },
          data: { activo: false },
        });
      }

      if (grupos_opcion_ids) {
        await tx.productoGrupo.deleteMany({ where: { producto_id: id } });
        if (grupos_opcion_ids.length > 0) {
          await tx.productoGrupo.createMany({
            data: grupos_opcion_ids.map((gid) => ({ producto_id: id, grupo_opcion_id: gid })),
          });
        }
      }

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.MENU_EDITAR,
          antes,
          despues: await this.instantanea(tx, id),
        },
        tx,
      );
    });

    this.realtime.menuActualizado();
    return this.producto(id);
  }

  /** Activar / desactivar. NUNCA borrar. */
  async cambiarActivo(id: number, activo: boolean, usuarioId: number) {
    const producto = await this.cambiarBandera(id, { activo }, usuarioId);
    this.realtime.menuActualizado();
    return producto;
  }

  /**
   * "Agotado hoy": se sigue viendo en el menú pero no se puede pedir.
   * Es distinto de desactivar — desactivar es "ya no lo vendemos".
   */
  async marcarAgotado(id: number, agotado: boolean, usuarioId: number) {
    const producto = await this.cambiarBandera(id, { agotado }, usuarioId);
    this.realtime.menuActualizado();
    return producto;
  }

  /**
   * Devuelve al menú todo lo que se agotó.
   * Se llama al abrir turno (prompt 6) y también a mano desde el panel: lo que
   * se acabó ayer normalmente hoy volvió a haber.
   */
  async limpiarAgotados(usuarioId: number) {
    const agotados = await this.prisma.producto.findMany({
      where: { agotado: true },
      select: { id: true, nombre_es: true },
    });
    if (agotados.length === 0) return { ok: true, limpiados: 0 };

    await this.prisma.$transaction(async (tx) => {
      await tx.producto.updateMany({ where: { agotado: true }, data: { agotado: false } });
      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.MENU_EDITAR,
          antes: { agotados },
          despues: { agotados: [] },
          motivo: 'Limpieza de agotados del día',
        },
        tx,
      );
    });

    this.realtime.menuActualizado();
    return { ok: true, limpiados: agotados.length };
  }

  // ── Reordenar ─────────────────────────────────────────────────────────────

  /** Reordenar por arrastre: la posición en el arreglo es el orden nuevo. */
  async reordenarProductos(ids: number[], usuarioId: number) {
    await this.prisma.$transaction(async (tx) => {
      for (const [orden, id] of ids.entries()) {
        await tx.producto.update({ where: { id }, data: { orden } });
      }
      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.MENU_EDITAR,
          despues: { reordenar: 'productos', ids },
        },
        tx,
      );
    });

    this.realtime.menuActualizado();
    return { ok: true, reordenados: ids.length };
  }

  async reordenarCategorias(ids: number[], usuarioId: number) {
    await this.prisma.$transaction(async (tx) => {
      for (const [orden, id] of ids.entries()) {
        await tx.categoria.update({ where: { id }, data: { orden } });
      }
      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.MENU_EDITAR,
          despues: { reordenar: 'categorias', ids },
        },
        tx,
      );
    });

    this.realtime.menuActualizado();
    return { ok: true, reordenados: ids.length };
  }

  // ── Grupos de opción ──────────────────────────────────────────────────────

  async gruposOpcion() {
    return this.prisma.grupoOpcion.findMany({
      orderBy: { nombre: 'asc' },
      include: { opciones: { orderBy: { id: 'asc' } }, _count: { select: { productos: true } } },
    });
  }

  async crearGrupoOpcion(dto: CrearGrupoOpcionDto, usuarioId: number) {
    const { opciones, ...datos } = dto;

    const grupo = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.grupoOpcion.create({
        data: {
          ...datos,
          opciones: {
            create: opciones.map((o) => ({
              nombre: o.nombre,
              precio_extra: o.precio_extra,
              activo: o.activo ?? true,
            })),
          },
        },
        include: { opciones: true },
      });
      await this.auditoria.registrar(
        { usuario_id: usuarioId, accion: AccionAuditoria.MENU_EDITAR, despues: creado },
        tx,
      );
      return creado;
    });

    this.realtime.menuActualizado();
    return grupo;
  }

  async actualizarGrupoOpcion(id: number, dto: ActualizarGrupoOpcionDto, usuarioId: number) {
    const { opciones, ...datos } = dto;

    const grupo = await this.prisma.$transaction(async (tx) => {
      const antes = await tx.grupoOpcion.findUnique({ where: { id }, include: { opciones: true } });
      if (!antes) throw new NotFoundException('No existe ese grupo de opción');

      // La coherencia se valida sobre el grupo YA combinado con lo guardado: así
      // "activar obligatorio" funciona sin tener que reenviar min_sel.
      const combinado = { ...antes, ...datos };
      if (combinado.max_sel < combinado.min_sel) {
        throw new BadRequestException(
          `El máximo de selecciones (${combinado.max_sel}) no puede ser menor que el mínimo (${combinado.min_sel})`,
        );
      }
      if (combinado.obligatorio && combinado.min_sel < 1) {
        throw new BadRequestException(
          'Un grupo obligatorio necesita al menos una selección: subí el mínimo a 1',
        );
      }

      await tx.grupoOpcion.update({ where: { id }, data: datos });

      if (opciones) {
        const conservadas: number[] = [];

        for (const o of opciones) {
          const datos = {
            nombre: o.nombre,
            precio_extra: o.precio_extra,
            activo: o.activo ?? true,
          };

          if (o.id !== undefined) {
            // Con id se renombra la opción existente ("Papas" → "Papas fritas").
            const actualizada = await tx.opcion.update({
              where: { id: o.id, grupo_opcion_id: id },
              data: datos,
            });
            conservadas.push(actualizada.id);
          } else {
            const creada = await tx.opcion.upsert({
              where: { grupo_opcion_id_nombre: { grupo_opcion_id: id, nombre: o.nombre } },
              update: datos,
              create: { grupo_opcion_id: id, ...datos },
            });
            conservadas.push(creada.id);
          }
        }

        // Igual que con las variantes: lo que sale de la lista se desactiva.
        // Hay líneas viejas que guardan `opcion_id` y su nombre congelado.
        await tx.opcion.updateMany({
          where: { grupo_opcion_id: id, id: { notIn: conservadas } },
          data: { activo: false },
        });
      }

      const despues = await tx.grupoOpcion.findUnique({
        where: { id },
        include: { opciones: true },
      });
      await this.auditoria.registrar(
        { usuario_id: usuarioId, accion: AccionAuditoria.MENU_EDITAR, antes, despues },
        tx,
      );
      return despues;
    });

    this.realtime.menuActualizado();
    return grupo;
  }

  // ── El envase ─────────────────────────────────────────────────────────────

  /**
   * El producto envase, que el cobro automático necesita.
   * ⚠️ Sus líneas van SIEMPRE al totalizador ENVASES, sin importar el canal de
   * la cuenta. Y marcar una línea de comida como `para_llevar` solo agrega este
   * cargo: no reclasifica la venta.
   */
  async productoEnvase() {
    const envase = await this.prisma.producto.findFirst({
      where: { es_envase: true, activo: true },
      include: { variantes: { where: { activo: true }, orderBy: { orden: 'asc' } } },
    });
    if (!envase || envase.variantes.length === 0) {
      throw new BadRequestException(
        'No hay un producto de envase configurado. Revisá el menú en el panel de admin.',
      );
    }
    return envase;
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private async cambiarBandera(
    id: number,
    data: { activo?: boolean; agotado?: boolean },
    usuarioId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.producto.findUnique({ where: { id } });
      if (!antes) throw new NotFoundException('No existe ese producto');

      const despues = await tx.producto.update({ where: { id }, data });
      await this.auditoria.registrar(
        { usuario_id: usuarioId, accion: AccionAuditoria.MENU_EDITAR, antes, despues },
        tx,
      );
      return despues;
    });
  }

  /** Producto + variantes, para el antes/después de la bitácora. */
  private async instantanea(tx: Prisma.TransactionClient, id: number) {
    return tx.producto.findUnique({
      where: { id },
      include: {
        variantes: { orderBy: { orden: 'asc' } },
        grupos: { select: { grupo_opcion_id: true } },
      },
    });
  }
}
