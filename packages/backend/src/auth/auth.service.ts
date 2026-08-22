import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { StringValue } from 'ms';
import { Rol, type LoginDto, type PayloadJwt, type Sesion } from '@brisas/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Autenticación por PIN de 4 dígitos.
 *
 * Es una red local en un restaurante, no un banco — pero el PIN va hasheado con
 * argon2, hay bloqueo tras N intentos fallidos y los permisos se validan en el
 * backend, nunca solo escondiendo botones en la interfaz.
 *
 * La tablet de COCINA no se loguea por persona: son varias cocineras frente a un
 * solo dispositivo y pedirles login sería fricción pura. La tablet tiene una
 * identidad de dispositivo y punto (ver `sesionCocina`).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Lista para la pantalla de login. Sin hashes, obviamente. */
  async usuariosParaLogin() {
    return this.prisma.usuario.findMany({
      where: { activo: true, rol: { not: Rol.COCINA } },
      select: { id: true, nombre: true, rol: true, color_hex: true },
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
    });
  }

  async login({ usuario_id, pin }: LoginDto): Promise<Sesion> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuario_id } });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario o PIN incorrecto');
    }

    if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) {
      const minutos = Math.ceil((usuario.bloqueado_hasta.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(
        `Demasiados intentos fallidos. Probá de nuevo en ${minutos} minuto(s).`,
      );
    }

    const correcto = await verify(usuario.pin_hash, pin).catch(() => false);

    if (!correcto) {
      await this.registrarFallo(usuario.id, usuario.intentos_fallidos);
      throw new UnauthorizedException('Usuario o PIN incorrecto');
    }

    if (usuario.intentos_fallidos > 0 || usuario.bloqueado_hasta) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentos_fallidos: 0, bloqueado_hasta: null },
      });
    }

    const payload: PayloadJwt = {
      sub: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol as Rol,
    };

    return {
      token: await this.jwt.signAsync(payload, { expiresIn: this.vigencia(usuario.rol as Rol) }),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol as Rol,
        color_hex: usuario.color_hex,
      },
    };
  }

  /**
   * Sesión de la tablet de cocina: sin PIN, sin persona.
   * La tablet arranca directo en la app, en modo kiosco, y nunca pide contraseña.
   */
  async sesionCocina(): Promise<Sesion> {
    const cocina = await this.prisma.usuario.findFirst({
      where: { rol: Rol.COCINA, activo: true },
    });
    if (!cocina) {
      throw new UnauthorizedException('No hay un usuario de cocina configurado');
    }

    const payload: PayloadJwt = { sub: cocina.id, nombre: cocina.nombre, rol: Rol.COCINA };
    return {
      // Larga: la tablet no debe quedarse afuera a media hora pico.
      token: await this.jwt.signAsync(payload, { expiresIn: '365d' }),
      usuario: {
        id: cocina.id,
        nombre: cocina.nombre,
        rol: Rol.COCINA,
        color_hex: cocina.color_hex,
      },
    };
  }

  async hashearPin(pin: string): Promise<string> {
    return hash(pin);
  }

  /**
   * La mesera no debe loguearse cada rato; caja vive menos por estar fija.
   *
   * El valor sale de `.env` como string plano — no hay forma de que TypeScript
   * verifique en tiempo de compilación que cumple el formato que espera `jwt`
   * (`"30d"`, `"12h"`, etc.). Quien instala es responsable de no romper ese
   * formato; documentado en `.env.example`.
   */
  private vigencia(rol: Rol): StringValue {
    if (rol === Rol.MESERA) return this.config.get('JWT_EXPIRES_MESERA', '30d') as StringValue;
    return this.config.get('JWT_EXPIRES_CAJA', '12h') as StringValue;
  }

  private async registrarFallo(usuarioId: number, fallosPrevios: number) {
    const maximo = Number(this.config.get('MAX_INTENTOS_PIN', 5));
    const minutos = Number(this.config.get('BLOQUEO_PIN_MINUTOS', 5));
    const fallos = fallosPrevios + 1;

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        intentos_fallidos: fallos,
        bloqueado_hasta: fallos >= maximo ? new Date(Date.now() + minutos * 60_000) : null,
      },
    });

    if (fallos >= maximo) {
      this.logger.warn(`Usuario ${usuarioId} bloqueado por ${minutos} min tras ${fallos} intentos`);
    }
  }
}
