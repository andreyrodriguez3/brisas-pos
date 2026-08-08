import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Filtro global. Toda respuesta de error sale con la misma forma y con el
 * mensaje en español: la caja y las meseras leen estos textos en pantalla.
 */
@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(excepcion: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let estado = HttpStatus.INTERNAL_SERVER_ERROR;
    let cuerpo: Record<string, unknown> = { mensaje: 'Ocurrió un error inesperado' };

    if (excepcion instanceof HttpException) {
      estado = excepcion.getStatus();
      const respuesta = excepcion.getResponse();
      cuerpo =
        typeof respuesta === 'string'
          ? { mensaje: respuesta }
          : (respuesta as Record<string, unknown>);
    } else if (excepcion instanceof Prisma.PrismaClientKnownRequestError) {
      ({ estado, cuerpo } = this.traducirPrisma(excepcion));
    } else if (excepcion instanceof Error) {
      this.logger.error(excepcion.message, excepcion.stack);
      cuerpo = { mensaje: excepcion.message };
    }

    if (estado >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${estado}`);
    }

    res.status(estado).json({
      ok: false,
      ...cuerpo,
      ruta: req.url,
      hora: new Date().toISOString(),
    });
  }

  private traducirPrisma(e: Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002': {
        const campos = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'un campo único';
        return {
          estado: HttpStatus.CONFLICT,
          cuerpo: { mensaje: `Ya existe un registro con ese valor (${campos})` },
        };
      }
      case 'P2003':
        return {
          estado: HttpStatus.BAD_REQUEST,
          cuerpo: { mensaje: 'El registro referenciado no existe' },
        };
      case 'P2025':
        return {
          estado: HttpStatus.NOT_FOUND,
          cuerpo: { mensaje: 'No se encontró el registro' },
        };
      default:
        this.logger.error(`Prisma ${e.code}: ${e.message}`);
        return {
          estado: HttpStatus.INTERNAL_SERVER_ERROR,
          cuerpo: { mensaje: 'Error de base de datos' },
        };
    }
  }
}
