import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PedidosService } from './pedidos.service';

describe('PedidosService: límites de opciones', () => {
  const service = new PedidosService(null!, null!, null!, null!, null!);
  const tx = {
    producto: {
      findUnique: async () => ({
        nombre_es: 'Casado',
        grupos: [
          { grupo: { id: 1, nombre: 'Guarnición', min_sel: 1, max_sel: 1, obligatorio: true } },
        ],
      }),
    },
    opcion: { findMany: async () => [{ grupo_opcion_id: 1 }, { grupo_opcion_id: 1 }] },
  };

  it('rechaza una selección obligatoria vacía', async () => {
    await expect(service['validarGrupos'](tx as never, 1, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza selecciones que exceden el máximo', async () => {
    await expect(service['validarGrupos'](tx as never, 1, [1, 2])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza opciones repetidas', async () => {
    await expect(service['validarGrupos'](tx as never, 1, [1, 1])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
