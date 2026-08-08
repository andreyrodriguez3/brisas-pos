import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

/**
 * Valida el body con un schema Zod de `@brisas/shared`.
 *
 * Los mismos schemas corren en el formulario del frontend: lo que la pantalla
 * acepta es exactamente lo que el endpoint acepta, sin dos verdades.
 *
 *   @Post()
 *   abrir(@Body(new ZodValidationPipe(abrirCuentaSchema)) dto: AbrirCuentaDto) {}
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(valor: unknown, _metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(valor);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException({
          mensaje: 'Los datos enviados no son válidos',
          errores: e.errors.map((err) => ({
            campo: err.path.join('.'),
            mensaje: err.message,
          })),
        });
      }
      throw e;
    }
  }
}
