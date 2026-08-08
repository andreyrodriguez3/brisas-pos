import { Controller, Get, Query } from '@nestjs/common';
import { Rol, rangoReporteSchema, type RangoReporteDto } from '@brisas/shared';
import { Roles } from '../auth/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ReportesService } from './reportes.service';

/** Reportes de la dueña. Solo lectura. */
@Controller('reportes')
@Roles(Rol.ADMIN)
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  /** Ventas del rango: por día, por mesera, por platillo y por forma de pago. */
  @Get('ventas')
  ventas(@Query(new ZodValidationPipe(rangoReporteSchema)) rango: RangoReporteDto) {
    return this.reportes.ventas(rango);
  }

  /** Salón vs. para llevar vs. envases. La cuenta aparte de la dueña. */
  @Get('canal')
  porCanal(@Query(new ZodValidationPipe(rangoReporteSchema)) rango: RangoReporteDto) {
    return this.reportes.porCanal(rango);
  }
}
