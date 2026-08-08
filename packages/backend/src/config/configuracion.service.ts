import { Injectable, Logger } from '@nestjs/common';
import {
  CLAVES_CONFIG,
  MIN_ALERTA_COCINA_DEFAULT,
  MIN_URGENTE_COCINA_DEFAULT,
  PRECIO_ENVASE_DEFAULT,
  ReglaReparto,
  type ClaveConfig,
} from '@brisas/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lee la tabla `configuracion`. La regla de reparto, el precio del envase y los
 * umbrales de cocina se ajustan sin tocar código.
 *
 * Se cachea en memoria porque se consulta en cada pedido; `invalidar()` lo limpia
 * cuando admin guarda un cambio. Una sola instancia del backend, un solo caché.
 */
@Injectable()
export class ConfiguracionService {
  private readonly logger = new Logger('Configuracion');
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async todas(): Promise<Record<string, string>> {
    await this.cargar();
    return Object.fromEntries(this.cache);
  }

  async valor(clave: ClaveConfig, porDefecto: string): Promise<string> {
    await this.cargar();
    return this.cache.get(clave) ?? porDefecto;
  }

  async establecer(clave: string, valor: string): Promise<void> {
    await this.prisma.configuracion.upsert({
      where: { clave },
      update: { valor },
      create: { clave, valor },
    });
    this.invalidar();
  }

  invalidar(): void {
    this.cache.clear();
  }

  // ── Accesos tipados a las claves que usa el resto del sistema ─────────────

  /** ₡200 por unidad, precio único. */
  async precioEnvase(): Promise<number> {
    return this.entero(CLAVES_CONFIG.PRECIO_ENVASE, PRECIO_ENVASE_DEFAULT);
  }

  async umbralesCocina(): Promise<{ alerta: number; urgente: number }> {
    return {
      alerta: await this.entero(CLAVES_CONFIG.MIN_ALERTA_COCINA, MIN_ALERTA_COCINA_DEFAULT),
      urgente: await this.entero(CLAVES_CONFIG.MIN_URGENTE_COCINA, MIN_URGENTE_COCINA_DEFAULT),
    };
  }

  /** Cuál de las tres reglas manda. El cierre igual calcula y muestra las tres. */
  async reglaReparto(): Promise<ReglaReparto> {
    const valor = await this.valor(CLAVES_CONFIG.REGLA_REPARTO, ReglaReparto.ATRIBUCION);
    if (valor in ReglaReparto) return valor as ReglaReparto;
    this.logger.warn(`REGLA_REPARTO tiene un valor desconocido ("${valor}"); uso ATRIBUCION`);
    return ReglaReparto.ATRIBUCION;
  }

  /**
   * Siempre true hoy: los precios del menú ya traen el IVA 13% y el 10% de
   * servicio. La clave existe por si algún día cambia; mientras valga true, el
   * sistema no calcula ninguna aritmética de impuestos.
   */
  async preciosIncluyenImpuestos(): Promise<boolean> {
    return (await this.valor(CLAVES_CONFIG.PRECIOS_INCLUYEN_IMPUESTOS, 'true')) === 'true';
  }

  private async entero(clave: ClaveConfig, porDefecto: number): Promise<number> {
    const crudo = await this.valor(clave, String(porDefecto));
    const n = Number.parseInt(crudo, 10);
    if (!Number.isInteger(n)) {
      this.logger.warn(`${clave} no es un entero ("${crudo}"); uso ${porDefecto}`);
      return porDefecto;
    }
    return n;
  }

  private async cargar(): Promise<void> {
    if (this.cache.size > 0) return;
    const filas = await this.prisma.configuracion.findMany();
    for (const f of filas) this.cache.set(f.clave, f.valor);
  }
}
