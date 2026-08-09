import { Injectable, Logger } from '@nestjs/common';
import type { AccionAuditoria, FiltroAuditoriaDto } from '@brisas/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RegistroAuditoria {
  usuario_id: number;
  accion: AccionAuditoria;
  cuenta_id?: number | null;
  pedido_id?: number | null;
  linea_id?: number | null;
  antes?: unknown;
  despues?: unknown;
  motivo?: string | null;
}

/**
 * Servicio transversal de auditoría.
 *
 * INVARIANTE 5: la tabla es APPEND-ONLY. Acá solo hay `registrar` y consultas.
 * No existe update ni delete, y no debe crearse ninguno — ni endpoint, ni método.
 *
 * INVARIANTE 7: TODA mutación de cuenta, pedido o línea pasa por acá. Sin
 * excepciones. Es lo que hace posible la edición cruzada entre meseras: María
 * abre la cuenta de Don Carlos, Ana se la edita, y queda registrado quién tocó
 * qué sin que la responsable cambie.
 *
 * Se registra DENTRO de la misma transacción que la mutación (pasando `tx`), para
 * que no exista un cambio sin su rastro.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger('Auditoria');

  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    registro: RegistroAuditoria,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const cliente = tx ?? this.prisma;
    await cliente.auditoria.create({
      data: {
        usuario_id: registro.usuario_id,
        accion: registro.accion,
        cuenta_id: registro.cuenta_id ?? null,
        pedido_id: registro.pedido_id ?? null,
        linea_id: registro.linea_id ?? null,
        antes_json: this.serializar(registro.antes),
        despues_json: this.serializar(registro.despues),
        motivo: registro.motivo ?? null,
        // creado_en lo pone el servidor (@default(now())). Nunca el cliente.
      },
    });
  }

  /** Bitácora de una cuenta, para el desplegable de la ficha en caja. */
  async deCuenta(cuentaId: number) {
    return this.prisma.auditoria.findMany({
      where: { cuenta_id: cuentaId },
      include: { usuario: { select: { id: true, nombre: true, color_hex: true } } },
      orderBy: { creado_en: 'asc' },
    });
  }

  /**
   * Visor filtrable, para la dueña.
   *
   * Todos los filtros son opcionales y se combinan. El límite existe porque la
   * tabla crece con cada toque de cocina: sin él, un mes de operación traería
   * decenas de miles de registros a una pantalla que nadie va a leer entera.
   */
  async buscar(filtro: FiltroAuditoriaDto) {
    const registros = await this.prisma.auditoria.findMany({
      where: {
        ...(filtro.cuenta_id ? { cuenta_id: filtro.cuenta_id } : {}),
        ...(filtro.usuario_id ? { usuario_id: filtro.usuario_id } : {}),
        ...(filtro.accion ? { accion: filtro.accion } : {}),
        ...(filtro.antes_de_id ? { id: { lt: filtro.antes_de_id } } : {}),
        ...(filtro.desde || filtro.hasta
          ? {
              creado_en: {
                ...(filtro.desde ? { gte: new Date(filtro.desde) } : {}),
                ...(filtro.hasta ? { lte: new Date(filtro.hasta) } : {}),
              },
            }
          : {}),
      },
      include: { usuario: { select: { id: true, nombre: true, color_hex: true } } },
      // `id` en vez de `creado_en`: en este sistema coinciden siempre (auto-
      // incremental en orden de creación) y así "antes_de_id" es un cursor
      // exacto para "Cargar más", sin depender de que dos registros no caigan
      // nunca en el mismo milisegundo.
      orderBy: { id: 'desc' },
      take: filtro.limite,
    });
    return registros;
  }

  /**
   * ¿Alguien distinto a la mesera responsable tocó esta cuenta?
   * La ficha muestra un indicador visible cuando es así.
   */
  async editadaPorTerceros(cuentaId: number, responsableId: number | null): Promise<boolean> {
    if (responsableId === null) return false;
    const ajena = await this.prisma.auditoria.findFirst({
      where: { cuenta_id: cuentaId, usuario_id: { not: responsableId } },
      select: { id: true },
    });
    return ajena !== null;
  }

  private serializar(valor: unknown): string | null {
    if (valor === undefined || valor === null) return null;
    try {
      return JSON.stringify(valor);
    } catch {
      // Un JSON que no serializa no puede tumbar la operación que se auditaba.
      this.logger.warn('No se pudo serializar un valor de auditoría');
      return null;
    }
  }
}
