import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  EstadoCuenta,
  EstadoTurno,
  Rol,
  calcularTotalLinea,
  totalizarCuentas,
  ventasPorMesera,
  type AbrirTurnoDto,
  type AgregarMeseraDto,
  type CuentaDeCierre,
  type EstadoTurnoActual,
  type MarcarSalidaDto,
  type MeseraEnTurno,
  type EstadoTurno as EstadoTurnoValor,
} from '@brisas/shared';
import type { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { diaLocal, horasTrabajadas } from '../common/fechas';

/**
 * Turnos.
 *
 * Toda cuenta pertenece a un turno, así que sin esto no se puede abrir ni una.
 *
 * DECISIÓN (sigue vigente): si no hay ninguno abierto cuando una mesera va a
 * abrir una cuenta, se abre uno automáticamente en vez de frenarla con un
 * "pedile a caja que abra el turno". El restaurante trabaja con prisa y esa
 * fricción terminaría en pedidos anotados en papel. El turno automático queda
 * auditado; caja después le agrega las meseras con sus horas.
 */
@Injectable()
export class TurnosService {
  private readonly logger = new Logger('Turnos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** El turno abierto de hoy. Lo abre si no existe. */
  async turnoAbierto(usuarioId: number, tx?: Prisma.TransactionClient) {
    const cliente = tx ?? this.prisma;

    const abierto = await cliente.turno.findFirst({
      where: { estado: EstadoTurno.ABIERTO },
      orderBy: { abierto_en: 'desc' },
    });
    if (abierto) return abierto;

    const nuevo = await cliente.turno.create({
      data: {
        fecha: diaLocal(),
        abierto_por_id: usuarioId,
        estado: EstadoTurno.ABIERTO,
        // abierto_en lo pone el servidor (@default(now())). Nunca el cliente.
      },
    });

    await this.auditoria.registrar(
      {
        usuario_id: usuarioId,
        accion: AccionAuditoria.TURNO_ABRIR,
        despues: nuevo,
        motivo: 'Apertura automática al abrir la primera cuenta del día',
      },
      tx,
    );

    this.logger.log(`Turno ${nuevo.id} abierto automáticamente para el ${nuevo.fecha}`);
    return nuevo;
  }

  /** Sin crear nada. Para pantallas que solo quieren mostrar el estado. */
  async turnoAbiertoONulo() {
    return this.prisma.turno.findFirst({
      where: { estado: EstadoTurno.ABIERTO },
      orderBy: { abierto_en: 'desc' },
    });
  }

  // ── Apertura explícita desde caja ─────────────────────────────────────────

  /**
   * Abre el turno del día marcando quiénes entran y a qué hora.
   *
   * Si ya había uno abierto (el automático), no se crea otro: se le agregan las
   * meseras. Dos turnos abiertos a la vez partirían las ventas del día en dos y
   * el cierre no cuadraría.
   */
  async abrir(dto: AbrirTurnoDto, usuarioId: number) {
    const turno = await this.turnoAbierto(usuarioId);

    for (const mesera of dto.meseras) {
      await this.agregarMesera(turno.id, mesera, usuarioId);
    }

    // Los "agotado hoy" son del día anterior: al abrir el día vuelven a estar
    // disponibles. Si algo sigue agotado, cocina lo vuelve a marcar.
    const limpiados = await this.prisma.producto.updateMany({
      where: { agotado: true },
      data: { agotado: false },
    });
    if (limpiados.count > 0) {
      this.logger.log(`${limpiados.count} producto(s) dejaron de estar agotados`);
      this.realtime.menuActualizado();
    }

    this.realtime.turnoAbierto(turno.id);
    return this.estado();
  }

  /**
   * Alta de una mesera, al abrir o a mitad de turno.
   *
   * `hora_entrada` es una de las dos excepciones deliberadas al INVARIANTE 6:
   * no registra cuándo pasó algo en el sistema, sino lo que la caja afirma sobre
   * el mundo real ("María entró a las 11, aunque yo abro el turno a las 11:30").
   * Si no viene, la pone el servidor.
   */
  async agregarMesera(turnoId: number, dto: AgregarMeseraDto, usuarioId: number) {
    const turno = await this.exigirAbierto(turnoId);

    const usuario = await this.prisma.usuario.findUnique({ where: { id: dto.usuario_id } });
    if (!usuario || !usuario.activo) {
      throw new BadRequestException('Esa usuaria no existe o está desactivada');
    }
    if (usuario.rol === Rol.COCINA) {
      throw new BadRequestException('La tablet de cocina no es una mesera del turno');
    }

    // ⚠️ Sin filtrar por hora_salida: (turno_id, usuario_id) es único en la
    // base, así que una mesera que ya salió de este turno NO se puede volver
    // a agregar — el modelo es un alta y una baja por turno, no varios ciclos
    // de entrada/salida. Si esto se buscara solo entre las activas (hora_salida
    // null), el intento de volver a agregarla pasaría este chequeo y reventaría
    // más abajo contra la restricción única de la base, con un mensaje crudo
    // de Prisma en vez de uno que la cajera entienda.
    const yaEstuvo = await this.prisma.turnoMesera.findFirst({
      where: { turno_id: turno.id, usuario_id: dto.usuario_id },
    });
    if (yaEstuvo) {
      throw new BadRequestException(
        yaEstuvo.hora_salida
          ? `${usuario.nombre} ya salió de este turno y no se puede volver a agregar en el mismo día.`
          : `${usuario.nombre} ya está en el turno.`,
      );
    }

    const entrada = dto.hora_entrada ? new Date(dto.hora_entrada) : new Date();

    const creada = await this.prisma.$transaction(async (tx) => {
      const registro = await tx.turnoMesera.create({
        data: { turno_id: turno.id, usuario_id: dto.usuario_id, hora_entrada: entrada },
      });
      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.TURNO_MESERA_ENTRADA,
          despues: { usuario: usuario.nombre, hora_entrada: entrada.toISOString() },
          motivo: dto.hora_entrada
            ? 'Hora de entrada escrita por caja'
            : 'Hora de entrada tomada del reloj del servidor',
        },
        tx,
      );
      return registro;
    });

    this.logger.log(`${usuario.nombre} entró al turno ${turno.id}`);
    return creada;
  }

  /** Baja: la mesera se va antes de que cierre el día. */
  async marcarSalida(turnoMeseraId: number, dto: MarcarSalidaDto, usuarioId: number) {
    const registro = await this.prisma.turnoMesera.findUnique({
      where: { id: turnoMeseraId },
      include: { usuario: { select: { nombre: true } }, turno: true },
    });
    if (!registro) throw new NotFoundException('Esa mesera no está en el turno');
    if (registro.turno.estado !== EstadoTurno.ABIERTO) {
      throw new BadRequestException('Ese turno ya se cerró');
    }

    const salida = dto.hora_salida ? new Date(dto.hora_salida) : new Date();
    if (salida < registro.hora_entrada) {
      throw new BadRequestException('La hora de salida no puede ser anterior a la de entrada');
    }

    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.turnoMesera.update({
        where: { id: turnoMeseraId },
        data: { hora_salida: salida },
      });
      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.TURNO_MESERA_SALIDA,
          antes: { hora_salida: null },
          despues: {
            usuario: registro.usuario.nombre,
            hora_salida: salida.toISOString(),
            horas: Number(horasTrabajadas(registro.hora_entrada, salida).toFixed(2)),
          },
        },
        tx,
      );
      return actualizado;
    });
  }

  // ── Estado del turno ──────────────────────────────────────────────────────

  /** Lo que la pantalla de turno necesita: quién trabaja, qué falta y cuánto va. */
  async estado(): Promise<EstadoTurnoActual> {
    const turno = await this.turnoAbiertoONulo();
    if (!turno) {
      return {
        turno: null,
        meseras: [],
        cuentas_sin_resolver: [],
        totalizadores: { salon: 0, para_llevar: 0, envases: 0 },
        puede_cerrar: false,
      };
    }

    const cuentas = await this.cuentasDelTurno(turno.id);
    const cobrables = cuentas.filter((c) => c.estado === EstadoCuenta.COBRADA);
    const totalizadores = totalizarCuentas(cobrables.map(aCuentaDeCierre));

    const registros = await this.prisma.turnoMesera.findMany({
      where: { turno_id: turno.id },
      include: { usuario: { select: { nombre: true, color_hex: true } } },
      orderBy: { hora_entrada: 'asc' },
    });

    const ventas = ventasPorMesera(
      cobrables.map(aCuentaDeCierre),
      registros.map((r) => r.usuario_id),
    );

    const meseras: MeseraEnTurno[] = registros.map((r, i) => ({
      id: r.id,
      usuario_id: r.usuario_id,
      nombre: r.usuario.nombre,
      color_hex: r.usuario.color_hex,
      hora_entrada: r.hora_entrada.toISOString(),
      hora_salida: r.hora_salida?.toISOString() ?? null,
      horas_trabajadas: Number(horasTrabajadas(r.hora_entrada, r.hora_salida).toFixed(2)),
      ventas_atribuidas: ventas[i]?.ventas ?? 0,
    }));

    const sinResolver = cuentas
      .filter((c) => c.estado === EstadoCuenta.ABIERTA || c.estado === EstadoCuenta.EN_COBRO)
      .map((c) => ({
        id: c.id,
        nombre_cliente: c.nombre_cliente,
        total: c.pedidos.reduce(
          (t, p) => t + p.lineas.reduce((s, l) => s + calcularTotalLinea(l), 0),
          0,
        ),
      }));

    return {
      // Las fechas viajan como ISO 8601: Prisma las devuelve como Date.
      turno: {
        ...turno,
        fecha: turno.fecha,
        abierto_en: turno.abierto_en.toISOString(),
        cerrado_en: turno.cerrado_en?.toISOString() ?? null,
        estado: turno.estado as EstadoTurnoValor,
      },
      meseras,
      cuentas_sin_resolver: sinResolver,
      totalizadores,
      puede_cerrar: sinResolver.length === 0,
    };
  }

  // ── Internos compartidos con el cierre ────────────────────────────────────

  /** Las cuentas del turno con todo lo que hace falta para totalizar. */
  async cuentasDelTurno(turnoId: number) {
    return this.prisma.cuenta.findMany({
      where: { turno_id: turnoId },
      include: {
        mesera_responsable: { select: { nombre: true, color_hex: true } },
        descuentos: true,
        pagos: true,
        pedidos: {
          include: {
            lineas: {
              include: {
                opciones: { select: { precio_extra_snapshot: true } },
                producto: { select: { id: true, nombre_es: true, es_envase: true, categoria_id: true } },
              },
            },
          },
        },
      },
    });
  }

  private async exigirAbierto(turnoId: number) {
    const turno = await this.prisma.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundException('No existe ese turno');
    if (turno.estado !== EstadoTurno.ABIERTO) {
      throw new BadRequestException('Ese turno ya se cerró');
    }
    return turno;
  }
}

/** Traduce una cuenta de la base a lo que `shared/money/cierre` sabe totalizar. */
export function aCuentaDeCierre(cuenta: {
  canal: string;
  mesera_responsable_id: number | null;
  pedidos: Array<{
    lineas: Array<{
      cantidad: number;
      precio_unit_snapshot: number;
      anulada: boolean;
      opciones: Array<{ precio_extra_snapshot: number }>;
      producto: { es_envase: boolean };
    }>;
  }>;
}): CuentaDeCierre {
  return {
    canal: cuenta.canal as CuentaDeCierre['canal'],
    mesera_responsable_id: cuenta.mesera_responsable_id,
    lineas: cuenta.pedidos.flatMap((p) =>
      p.lineas.map((l) => ({
        cantidad: l.cantidad,
        precio_unit_snapshot: l.precio_unit_snapshot,
        anulada: l.anulada,
        opciones: l.opciones,
        // Lo ÚNICO que decide la bolsa, junto con el canal de la cuenta.
        es_envase: l.producto.es_envase,
      })),
    ),
  };
}
