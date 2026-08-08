import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { validarSecretoJwt } from './secreto';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Se valida acá y no en `main.ts` a propósito: es el único punto por el
        // que pasa sí o sí. En producción, un secreto de ejemplo impide arrancar.
        secret: validarSecretoJwt(
          config.get<string>('JWT_SECRET'),
          config.get<string>('NODE_ENV', 'development'),
        ),
        // La vigencia se decide por rol al firmar (ver AuthService.vigencia).
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
