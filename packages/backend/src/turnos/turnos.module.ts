import { Global, Module } from '@nestjs/common';
import { CierreService } from './cierre.service';
import { CierresController, TurnosController } from './turnos.controller';
import { TurnosService } from './turnos.service';

/** Global porque cuentas y pedidos necesitan el turno abierto para existir. */
@Global()
@Module({
  controllers: [TurnosController, CierresController],
  providers: [TurnosService, CierreService],
  exports: [TurnosService, CierreService],
})
export class TurnosModule {}
