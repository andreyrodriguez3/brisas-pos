import { Controller, Get } from '@nestjs/common';
import { Publico } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Healthcheck.
 *
 * Lo consultan el watchdog de arranque, el script de respaldo y las apps para
 * saber si el servidor está vivo antes de mostrar el banner de "SIN CONEXIÓN".
 * Público a propósito: si necesitara token, no serviría para diagnosticar —
 * justo cuando algo falla es cuando no se puede pedir un login.
 *
 * No devuelve nada sensible: ni conteos de ventas, ni nombres, ni rutas.
 */
@Controller('health')
export class HealthController {
  private readonly arrancoEn = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Publico()
  @Get()
  async estado() {
    let baseDatos = 'ok';
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch (e) {
      baseDatos = e instanceof Error ? `error: ${e.message}` : 'error';
    }

    return {
      ok: baseDatos === 'ok',
      servicio: 'brisas-pos',
      base_datos: baseDatos,
      hora_servidor: new Date().toISOString(),
      encendido_segundos: Math.floor((Date.now() - this.arrancoEn) / 1000),
    };
  }

  /**
   * Sonda mínima para NSSM y PM2: 200 si el proceso responde, sin tocar la base.
   *
   * Está separada de `/health` porque un watchdog que consulta la base cada
   * pocos segundos compite por el archivo SQLite justo cuando la caja está
   * cobrando. Esto solo dice "el proceso está vivo y atiende HTTP".
   */
  @Publico()
  @Get('ping')
  ping() {
    return { ok: true };
  }
}
