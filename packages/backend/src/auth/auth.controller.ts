import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
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

  @Publico()
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
