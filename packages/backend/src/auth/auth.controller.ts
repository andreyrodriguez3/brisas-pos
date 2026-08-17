import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { loginSchema, type LoginDto, type PayloadJwt } from '@brisas/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { Publico } from './roles.decorator';
import { UsuarioActual } from './usuario-actual.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Para pintar los botones de la pantalla de login. */
  @Publico()
  @Get('usuarios')
  usuarios() {
    return this.auth.usuariosParaLogin();
  }

  /**
   * Límite propio, más estricto que el global: `AuthService` ya bloquea a una
   * usuaria tras 5 PIN fallidos, pero eso es POR usuaria — nada frenaba a un
   * dispositivo que probara PINs contra TODAS las usuarias en paralelo.
   */
  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** La tablet de cocina entra sin PIN. Ver AuthService.sesionCocina. */
  @Publico()
  @HttpCode(200)
  @Post('cocina')
  cocina() {
    return this.auth.sesionCocina();
  }

  @Get('yo')
  yo(@UsuarioActual() usuario: PayloadJwt) {
    return usuario;
  }
}
