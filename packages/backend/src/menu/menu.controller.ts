import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import {
  Rol,
  actualizarCategoriaSchema,
  actualizarGrupoOpcionSchema,
  actualizarProductoSchema,
  cambiarActivoSchema,
  crearCategoriaSchema,
  crearGrupoOpcionSchema,
  crearProductoSchema,
  marcarAgotadoSchema,
  reordenarSchema,
  type ActualizarCategoriaDto,
  type ActualizarGrupoOpcionDto,
  type ActualizarProductoDto,
  type CambiarActivoDto,
  type CrearCategoriaDto,
  type CrearGrupoOpcionDto,
  type CrearProductoDto,
  type MarcarAgotadoDto,
  type ReordenarDto,
} from '@brisas/shared';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MenuService } from './menu.service';

/**
 * El menú.
 *
 * Escritura solo para ADMIN, salvo "agotado hoy", que también puede marcar caja:
 * si se acaba el pescado un domingo a mediodía no hay por qué llamar a la dueña.
 *
 * Todas las mutaciones auditan con el antes y el después reales dentro de su
 * transacción (ver MenuService), así que acá no va `@Auditar`: duplicaría el
 * registro y el del interceptor sería el peor de los dos, porque solo guarda el
 * body de la petición y no el estado previo.
 */
@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  // ── Lectura: cualquier rol autenticado ────────────────────────────────────

  @Get()
  catalogo() {
    return this.menu.catalogo();
  }

  @Get('admin')
  @Roles(Rol.ADMIN, Rol.CAJA)
  catalogoAdmin() {
    return this.menu.catalogoAdmin();
  }

  @Get('grupos-opcion')
  @Roles(Rol.ADMIN, Rol.CAJA)
  gruposOpcion() {
    return this.menu.gruposOpcion();
  }

  @Get('envase')
  envase() {
    return this.menu.productoEnvase();
  }

  @Get('productos/:id')
  producto(@Param('id', ParseIntPipe) id: number) {
    return this.menu.producto(id);
  }

  // ── Reordenar (antes que las rutas con :id, para que no las tapen) ────────

  @Patch('productos/reordenar')
  @Roles(Rol.ADMIN)
  reordenarProductos(
    @Body(new ZodValidationPipe(reordenarSchema)) dto: ReordenarDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.reordenarProductos(dto.ids, usuarioId);
  }

  @Patch('categorias/reordenar')
  @Roles(Rol.ADMIN)
  reordenarCategorias(
    @Body(new ZodValidationPipe(reordenarSchema)) dto: ReordenarDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.reordenarCategorias(dto.ids, usuarioId);
  }

  /** Devuelve al menú todo lo que se agotó. Se corre al abrir el día. */
  @Patch('productos/limpiar-agotados')
  @Roles(Rol.ADMIN, Rol.CAJA)
  limpiarAgotados(@UsuarioActual('sub') usuarioId: number) {
    return this.menu.limpiarAgotados(usuarioId);
  }

  // ── Categorías ────────────────────────────────────────────────────────────

  @Post('categorias')
  @Roles(Rol.ADMIN)
  crearCategoria(
    @Body(new ZodValidationPipe(crearCategoriaSchema)) dto: CrearCategoriaDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.crearCategoria(dto, usuarioId);
  }

  @Put('categorias/:id')
  @Roles(Rol.ADMIN)
  actualizarCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(actualizarCategoriaSchema)) dto: ActualizarCategoriaDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.actualizarCategoria(id, dto, usuarioId);
  }

  // ── Productos ─────────────────────────────────────────────────────────────

  @Post('productos')
  @Roles(Rol.ADMIN)
  crearProducto(
    @Body(new ZodValidationPipe(crearProductoSchema)) dto: CrearProductoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.crearProducto(dto, usuarioId);
  }

  @Put('productos/:id')
  @Roles(Rol.ADMIN)
  actualizarProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(actualizarProductoSchema)) dto: ActualizarProductoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.actualizarProducto(id, dto, usuarioId);
  }

  /** Activar / desactivar. Nunca se borra un producto. */
  @Patch('productos/:id/activo')
  @Roles(Rol.ADMIN)
  cambiarActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(cambiarActivoSchema)) dto: CambiarActivoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.cambiarActivo(id, dto.activo, usuarioId);
  }

  /** "Agotado hoy". Lo puede marcar caja también, sin llamar a la dueña. */
  @Patch('productos/:id/agotado')
  @Roles(Rol.ADMIN, Rol.CAJA)
  marcarAgotado(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(marcarAgotadoSchema)) dto: MarcarAgotadoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.marcarAgotado(id, dto.agotado, usuarioId);
  }

  // ── Grupos de opción ──────────────────────────────────────────────────────

  @Post('grupos-opcion')
  @Roles(Rol.ADMIN)
  crearGrupoOpcion(
    @Body(new ZodValidationPipe(crearGrupoOpcionSchema)) dto: CrearGrupoOpcionDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.crearGrupoOpcion(dto, usuarioId);
  }

  @Put('grupos-opcion/:id')
  @Roles(Rol.ADMIN)
  actualizarGrupoOpcion(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(actualizarGrupoOpcionSchema)) dto: ActualizarGrupoOpcionDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.menu.actualizarGrupoOpcion(id, dto, usuarioId);
  }
}
