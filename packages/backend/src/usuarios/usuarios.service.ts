import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  PALETA_MESERAS,
  Rol,
  buscarColorMesera,
  primerColorLibre,
  type ActualizarUsuarioDto,
  type CrearUsuarioDto,
} from '@brisas/shared';
import { AuthService } from '../auth/auth.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';

/** El hash del PIN NUNCA sale del backend, ni siquiera hacia el panel de admin. */
const SIN_HASH = {
  id: true,
  nombre: true,
  rol: true,
  color_hex: true,
  activo: true,
  creado_en: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(incluirInactivas = false) {
    return this.prisma.usuario.findMany({
      where: incluirInactivas ? {} : { activo: true },
      select: SIN_HASH,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
  }

  async buscar(id: number) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: SIN_HASH });
    if (!usuario) throw new NotFoundException('No existe esa usuaria');
    return usuario;
  }

  /**
   * La paleta con el estado de cada color, para pintar el selector del panel.
   * Los tomados se muestran igual, marcados y con el nombre de quien lo tiene:
   * es más útil que esconderlos.
   */
  async paletaConEstado() {
    const meseras = await this.prisma.usuario.findMany({
      where: { activo: true, rol: Rol.MESERA },
      select: { id: true, nombre: true, color_hex: true },
    });
    const porHex = new Map(meseras.map((m) => [m.color_hex.toUpperCase(), m]));

    return PALETA_MESERAS.map((color) => {
      const duena = porHex.get(color.hex.toUpperCase());
      return {
        ...color,
        libre: !duena,
        usado_por: duena ? { id: duena.id, nombre: duena.nombre } : null,
      };
    });
  }

  async crear(dto: CrearUsuarioDto, usuarioId: number) {
    if (dto.rol === Rol.MESERA) await this.exigirColorLibre(dto.color_hex);

    const creada = await this.prisma.$transaction(async (tx) => {
      const usuaria = await tx.usuario.create({
        data: {
          nombre: dto.nombre,
          rol: dto.rol,
          color_hex: dto.color_hex.toUpperCase(),
          pin_hash: await this.auth.hashearPin(dto.pin),
        },
        select: SIN_HASH,
      });

      await this.auditoria.registrar(
        { usuario_id: usuarioId, accion: AccionAuditoria.USUARIO_EDITAR, despues: usuaria },
        tx,
      );
      return usuaria;
    });

    return creada;
  }

  async actualizar(id: number, dto: ActualizarUsuarioDto, usuarioId: number) {
    const actual = await this.prisma.usuario.findUnique({ where: { id }, select: SIN_HASH });
    if (!actual) throw new NotFoundException('No existe esa usuaria');

    // El color solo se reserva entre meseras; hay que mirar el rol RESULTANTE,
    // no el actual: pasar a alguien de caja a mesera también reserva su color.
    const rolResultante = dto.rol ?? (actual.rol as Rol);
    if (dto.color_hex && rolResultante === Rol.MESERA) {
      await this.exigirColorLibre(dto.color_hex, id);
    }

    const { pin, ...datos } = dto;

    return this.prisma.$transaction(async (tx) => {
      const despues = await tx.usuario.update({
        where: { id },
        data: {
          ...datos,
          ...(datos.color_hex ? { color_hex: datos.color_hex.toUpperCase() } : {}),
          // Cambiar el PIN limpia el bloqueo por intentos fallidos: es
          // justamente lo que se hace cuando una mesera se quedó afuera.
          ...(pin
            ? {
                pin_hash: await this.auth.hashearPin(pin),
                intentos_fallidos: 0,
                bloqueado_hasta: null,
              }
            : {}),
        },
        select: SIN_HASH,
      });

      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.USUARIO_EDITAR,
          antes: actual,
          despues,
          // ⚠️ El PIN jamás entra a la bitácora: `auditoria` es append-only y la
          // pueden leer caja y admin. Solo queda constancia de que se cambió.
          motivo: pin ? 'Se cambió el PIN' : undefined,
        },
        tx,
      );
      return despues;
    });
  }

  /**
   * INVARIANTE 4: no se borra, se desactiva.
   * Sus cuentas viejas, sus ventas atribuidas y su historial siguen siendo suyos,
   * y su color queda libre para otra mesera.
   */
  async cambiarActivo(id: number, activo: boolean, usuarioId: number) {
    const actual = await this.prisma.usuario.findUnique({ where: { id }, select: SIN_HASH });
    if (!actual) throw new NotFoundException('No existe esa usuaria');

    // Al reactivar hay que revisar el color de nuevo: alguien pudo haberlo
    // tomado mientras estuvo inactiva.
    if (activo && !actual.activo && actual.rol === Rol.MESERA) {
      await this.exigirColorLibre(actual.color_hex, id);
    }

    if (!activo) await this.exigirQueQuedeUnaAdmin(id);

    return this.prisma.$transaction(async (tx) => {
      const despues = await tx.usuario.update({
        where: { id },
        data: { activo },
        select: SIN_HASH,
      });
      await this.auditoria.registrar(
        {
          usuario_id: usuarioId,
          accion: AccionAuditoria.USUARIO_EDITAR,
          antes: actual,
          despues,
          motivo: activo ? 'Reactivada' : 'Desactivada',
        },
        tx,
      );
      return despues;
    });
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /**
   * Dos meseras activas con el mismo color se confunden en las tres pantallas.
   * Los roles que no son MESERA sí pueden repetir: sus cuentas no se listan por
   * color en el salón.
   */
  private async exigirColorLibre(hex: string, exceptoId?: number) {
    const enUso = await this.coloresEnUso(exceptoId);
    if (!enUso.includes(hex.toUpperCase())) return;

    const libre = primerColorLibre(enUso);
    const nombre = buscarColorMesera(hex)?.nombre ?? hex;
    throw new BadRequestException(
      libre
        ? `El color ${nombre} ya lo tiene otra mesera activa. Probá con ${libre.nombre}.`
        : `El color ${nombre} ya está en uso y no quedan colores libres en la paleta. Desactivá una mesera o cambiale el color primero.`,
    );
  }

  private async coloresEnUso(exceptoId?: number): Promise<string[]> {
    const meseras = await this.prisma.usuario.findMany({
      where: {
        activo: true,
        rol: Rol.MESERA,
        ...(exceptoId ? { id: { not: exceptoId } } : {}),
      },
      select: { color_hex: true },
    });
    return meseras.map((m) => m.color_hex.toUpperCase());
  }

  /** Si se desactiva la última admin, nadie puede volver a entrar al panel. */
  private async exigirQueQuedeUnaAdmin(id: number) {
    const usuaria = await this.prisma.usuario.findUnique({ where: { id }, select: { rol: true } });
    if (usuaria?.rol !== Rol.ADMIN) return;

    const otras = await this.prisma.usuario.count({
      where: { rol: Rol.ADMIN, activo: true, id: { not: id } },
    });
    if (otras === 0) {
      throw new BadRequestException(
        'Es la única administradora activa. Si la desactivás, nadie va a poder entrar al panel.',
      );
    }
  }
}
