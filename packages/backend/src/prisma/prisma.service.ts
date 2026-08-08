import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cuánto espera una petición por su turno de escribir antes de rendirse.
 * Generoso a propósito: en hora pico es mejor que la mesera espere medio
 * segundo a que le salga un error y tenga que volver a tomar el pedido.
 */
const TIMEOUT_TRANSACCION_MS = 15_000;

/**
 * Conexión a SQLite.
 *
 * ⚠️ `connection_limit=1` no es un ajuste de rendimiento: es LA configuración
 * correcta para SQLite, y sin ella el sistema se cae en hora pico.
 *
 * SQLite tiene UN solo escritor. Si Prisma abre varias conexiones, se pelean
 * por el lock y las que pierden fallan con P1008 — y peor: los `PRAGMA` de
 * abajo se aplican **por conexión**, así que solo una de ellas quedaría con
 * `busy_timeout` configurado y las demás morirían de una. Con una sola
 * conexión, Prisma hace la cola en su propio pool: las peticiones esperan
 * ordenadas en vez de chocar.
 *
 * Esto se descubrió en la prueba de carga: 15 cuentas simultáneas dejaban 11
 * en error 500. Con una conexión, las 15 pasan.
 */
function urlConLimiteDeConexion(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes('connection_limit')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  constructor() {
    const url = urlConLimiteDeConexion();
    super({
      ...(url ? { datasources: { db: { url } } } : {}),
      // El valor por defecto de Prisma son 5 s, y con una sola conexión que
      // atiende a tres dispositivos eso se agota en el peor momento.
      transactionOptions: {
        timeout: TIMEOUT_TRANSACCION_MS,
        maxWait: TIMEOUT_TRANSACCION_MS,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Los PRAGMA devuelven filas, así que van por $queryRawUnsafe:
    // $executeRawUnsafe falla con "Execute returned results, which is not
    // allowed in SQLite".
    //
    // Se aplican a LA conexión (una sola, ver arriba). Si algún día se
    // levantara el límite, habría que volver a aplicarlos en cada una.

    // WAL: permite leer mientras se escribe. Sin esto, la tablet de cocina y los
    // celulares se quedan esperando cada vez que la caja guarda algo.
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    // NORMAL con WAL es seguro ante caída del proceso; solo un corte de luz del
    // sistema operativo podría perder la última transacción. Hay UPS y respaldo.
    await this.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    // Si otra conexión tiene la escritura, esperar en vez de fallar de una.
    await this.$queryRawUnsafe('PRAGMA busy_timeout = 15000;');
    await this.$queryRawUnsafe('PRAGMA foreign_keys = ON;');

    const [{ journal_mode }] =
      await this.$queryRawUnsafe<Array<{ journal_mode: string }>>('PRAGMA journal_mode;');
    this.logger.log(`SQLite lista (journal_mode=${journal_mode}, connection_limit=1)`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
