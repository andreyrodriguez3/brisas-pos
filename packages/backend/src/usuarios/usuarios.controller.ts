import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import {
  Rol,
  actualizarUsuarioSchema,
  cambiarActivoSchema,
  crearUsuarioSchema,
  type ActualizarUsuarioDto,
  type CambiarActivoDto,
  type CrearUsuarioDto,
} from '@brisas/shared';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsuariosService } from './usuarios.service';

/**
 * Usuarias.
 *
 * Sin `@Auditar`: el interceptor guarda el body de la petición tal cual, y acá
 * el body puede traer un PIN. UsuariosService audita explícitamente el antes y
 * el después SIN el PIN — `auditoria` es append-only y la leen caja y admin.
 */
@Controller('usuarios')
// La tablet de cocina no tiene nada que hacer acá: su token se emite sin PIN.
@Roles(Rol.MESERA, Rol.CAJA)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /** Meseras activas: las apps lo usan para pintar colores y nombres. */
  @Get()
  listar(@Query('todas') todas?: string) {
    return this.usuarios.listar(todas === 'true');
  }

  /** La paleta completa con quién tiene cada color, para el selector del panel. */
  @Get('paleta')
  @Roles(Rol.ADMIN)
  paleta() {
    return this.usuarios.paletaConEstado();
  }

  @Get(':id')
  buscar(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.buscar(id);
  }

  @Post()
  @Roles(Rol.ADMIN)
  crear(
    @Body(new ZodValidationPipe(crearUsuarioSchema)) dto: CrearUsuarioDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.usuarios.crear(dto, usuarioId);
  }

  @Put(':id')
  @Roles(Rol.ADMIN)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(actualizarUsuarioSchema)) dto: ActualizarUsuarioDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.usuarios.actualizar(id, dto, usuarioId);
  }

  /** Desactivar o reactivar. Nunca se borra: su historial sigue siendo suyo. */
  @Patch(':id/activo')
  @Roles(Rol.ADMIN)
  cambiarActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(cambiarActivoSchema)) dto: CambiarActivoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.usuarios.cambiarActivo(id, dto.activo, usuarioId);
  }
}
