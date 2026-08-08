import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import {
  Rol,
  abrirTurnoSchema,
  agregarMeseraSchema,
  cerrarTurnoSchema,
  marcarSalidaSchema,
  type AbrirTurnoDto,
  type AgregarMeseraDto,
  type CerrarTurnoDto,
  type MarcarSalidaDto,
} from '@brisas/shared';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CierreService } from './cierre.service';
import { TurnosService } from './turnos.service';

/**
 * Turnos y cierre del día.
 *
 * Todo pide rol CAJA (la dueña pasa siempre). Abrir el turno, marcar horas y
 * cerrar el día no son cosas de la mesera, y el rol se valida acá y no
 * escondiendo botones: cualquiera en la LAN puede llamar la API con curl.
 */
@Controller('turnos')
@Roles(Rol.CAJA)
export class TurnosController {
  constructor(
    private readonly turnos: TurnosService,
    private readonly cierre: CierreService,
  ) {}

  /** Quién trabaja, qué falta por cobrar y cuánto va vendido. */
  @Get('actual')
  actual() {
    return this.turnos.estado();
  }

  @Post('abrir')
  abrir(
    @Body(new ZodValidationPipe(abrirTurnoSchema)) dto: AbrirTurnoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.turnos.abrir(dto, usuarioId);
  }

  /** Alta a mitad de turno. */
  @Post(':id/meseras')
  agregarMesera(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(agregarMeseraSchema)) dto: AgregarMeseraDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.turnos.agregarMesera(id, dto, usuarioId);
  }

  /** Baja a mitad de turno. */
  @Put('meseras/:id/salida')
  marcarSalida(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(marcarSalidaSchema)) dto: MarcarSalidaDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.turnos.marcarSalida(id, dto, usuarioId);
  }

  /** Los números antes de cerrar. No guarda nada. */
  @Get(':id/previa')
  previa(@Param('id', ParseIntPipe) id: number) {
    return this.cierre.previa(id);
  }

  @Post(':id/cerrar')
  cerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(cerrarTurnoSchema)) dto: CerrarTurnoDto,
    @UsuarioActual('sub') usuarioId: number,
  ) {
    return this.cierre.cerrar(id, dto, usuarioId);
  }
}

/** Cierres ya hechos. Inmutables: solo se leen. */
@Controller('cierres')
@Roles(Rol.CAJA)
export class CierresController {
  constructor(private readonly cierre: CierreService) {}

  @Get()
  listar() {
    return this.cierre.listar();
  }

  /** Reimprimible: devuelve el desglose tal como se guardó ese día. */
  @Get(':id')
  ver(@Param('id', ParseIntPipe) id: number) {
    return this.cierre.ver(id);
  }
}
