import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditoriaInterceptor } from './auditoria/auditoria.interceptor';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { JwtGuard } from './auth/jwt.guard';
import { RolesGuard } from './auth/roles.guard';
import { CobroModule } from './cobro/cobro.module';
import { ConfiguracionModule } from './config/configuracion.module';
import { CuentasModule } from './cuentas/cuentas.module';
import { HealthModule } from './health/health.module';
import { MenuModule } from './menu/menu.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReportesModule } from './reportes/reportes.module';
import { TurnosModule } from './turnos/turnos.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      /*
       * El `.env` se busca al lado del paquete del backend, NO en el directorio
       * desde el que se arrancó. En desarrollo el proceso corre en
       * `packages/backend/` y en producción se arranca desde la raíz con
       * `npm run start:prod`: sin esto, cada uno leería un archivo distinto y el
       * JWT_SECRET que se generó en la instalación no sería el que usa el
       * servidor. La raíz queda de respaldo, por si alguien lo puso ahí.
       */
      envFilePath: [join(__dirname, '..', '.env'), join(__dirname, '..', '..', '..', '.env')],
    }),
    /*
     * Límite global por IP. No es para una app bancaria de internet: es para que
     * un dispositivo de la LAN no pueda martillar el login probando PIN tras PIN
     * contra todas las usuarias en paralelo (el bloqueo de AuthService es POR
     * usuaria, no por IP). El número es generoso a propósito — la tablet de
     * cocina y los celulares hacen ráfagas de peticiones normales en hora pico y
     * no tienen por qué toparse con esto. `/auth/login` tiene su propio límite
     * más estricto, ver AuthController.
     */
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    ConfiguracionModule,
    AuditoriaModule,
    RealtimeModule,
    AuthModule,
    TurnosModule,
    UsuariosModule,
    MenuModule,
    CuentasModule,
    PedidosModule,
    CobroModule,
    ReportesModule,
    HealthModule,
  ],
  providers: [
    // Primero el límite de peticiones, antes de gastar nada en verificar token o rol.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Todo endpoint pide token salvo los marcados con @Publico().
    { provide: APP_GUARD, useClass: JwtGuard },
    // Y el rol se valida SIEMPRE en el backend, no escondiendo botones.
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
  ],
})
export class AppModule {}
