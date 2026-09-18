import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { FiltroExcepciones } from './common/excepciones.filter';
import { origenCorsLan } from './common/origen-lan';

/** IPs de la PC en la LAN, para imprimirlas al arrancar. */
function ipsLocales(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const puerto = Number(config.get('PORT', 3000));

  // ⚠️ CRÍTICO: 0.0.0.0, no 127.0.0.1.
  // Si escucha en localhost, la PC de caja se ve a sí misma y NINGÚN celular ni
  // la tablet de cocina pueden conectarse. Es el error que deja el sistema
  // "funcionando" en la demo y muerto el día de la instalación.
  const host = config.get('HOST', '0.0.0.0');

  app.setGlobalPrefix('api', { exclude: [''] });

  // CORS abierto a la LAN: los dispositivos entran por IP privada, y el origen
  // cambia según qué IP tenga la PC ese día.
  app.enableCors({
    origin: origenCorsLan,
    credentials: true,
  });

  app.useGlobalFilters(new FiltroExcepciones());

  // En producción el backend sirve también el frontend compilado: todos los
  // dispositivos entran a una sola dirección, http://<IP-DE-CAJA>:3000
  const frontend = resolve(__dirname, '../../frontend/dist');
  if (existsSync(frontend)) {
    app.useStaticAssets(frontend, { index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.sendFile(join(frontend, 'index.html'));
    });
  }

  app.enableShutdownHooks();
  await app.listen(puerto, host);

  const log = new Logger('Brisas POS');
  log.log(`Escuchando en http://${host}:${puerto}`);
  if (host === '0.0.0.0') {
    for (const ip of ipsLocales()) {
      log.log(`  Desde la red WiFi:  http://${ip}:${puerto}`);
    }
  } else {
    log.warn(`HOST=${host} — los celulares y la tablet NO van a poder conectarse.`);
  }
  if (!existsSync(frontend)) {
    log.log('  (frontend sin compilar: en desarrollo se sirve aparte con Vite)');
  }
}

void bootstrap();
