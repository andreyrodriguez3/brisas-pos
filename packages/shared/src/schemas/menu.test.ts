import { describe, expect, it } from 'vitest';
import {
  actualizarGrupoOpcionSchema,
  actualizarProductoSchema,
  cambiarActivoSchema,
  crearGrupoOpcionSchema,
  crearProductoSchema,
  crearVarianteSchema,
  marcarAgotadoSchema,
} from './menu';

describe('crearVarianteSchema', () => {
  it('acepta una variante nueva sin id', () => {
    const r = crearVarianteSchema.parse({ etiqueta: 'Único', precio_colones: 4500 });
    expect(r).toMatchObject({ etiqueta: 'Único', precio_colones: 4500, orden: 0 });
    expect(r.id).toBeUndefined();
  });

  it('acepta el id de una variante que ya existe, para poder RENOMBRARLA', () => {
    // Sin el id, corregir las etiquetas supuestas ("Pequeño"/"Grande") de los 18
    // productos con rango de precio apagaría la variante vieja y crearía otra.
    const r = crearVarianteSchema.parse({ id: 7, etiqueta: 'Media porción', precio_colones: 3500 });
    expect(r.id).toBe(7);
  });

  it('null es un precio válido: significa "todavía no lo sabemos"', () => {
    expect(crearVarianteSchema.parse({ etiqueta: 'Único', precio_colones: null }).precio_colones).toBeNull();
  });

  it('rechaza precios con decimales', () => {
    expect(() => crearVarianteSchema.parse({ etiqueta: 'Único', precio_colones: 4500.5 })).toThrow();
  });

  it('rechaza precios negativos', () => {
    expect(() => crearVarianteSchema.parse({ etiqueta: 'Único', precio_colones: -1 })).toThrow();
  });

  it('rechaza etiqueta vacía', () => {
    expect(() => crearVarianteSchema.parse({ etiqueta: '   ', precio_colones: 100 })).toThrow();
  });
});

describe('crearProductoSchema', () => {
  const base = {
    categoria_id: 1,
    nombre_es: 'Casado',
    variantes: [{ etiqueta: 'Único', precio_colones: 4500 }],
  };

  it('pone los valores por defecto', () => {
    const r = crearProductoSchema.parse(base);
    expect(r).toMatchObject({ orden: 0, es_envase: false, grupos_opcion_ids: [] });
  });

  it('exige al menos una variante', () => {
    expect(() => crearProductoSchema.parse({ ...base, variantes: [] })).toThrow(
      /al menos una variante/,
    );
  });

  it('exige un nombre de verdad', () => {
    expect(() => crearProductoSchema.parse({ ...base, nombre_es: 'x' })).toThrow();
  });
});

describe('actualizarProductoSchema', () => {
  it('todo es opcional: se puede mandar solo el precio', () => {
    const r = actualizarProductoSchema.parse({
      variantes: [{ id: 1, etiqueta: 'Único', precio_colones: 5000 }],
    });
    expect(r.variantes?.[0].precio_colones).toBe(5000);
    expect(r.nombre_es).toBeUndefined();
  });

  it('acepta los interruptores de activo y agotado', () => {
    expect(actualizarProductoSchema.parse({ activo: false, agotado: true })).toEqual({
      activo: false,
      agotado: true,
    });
  });
});

describe('crearGrupoOpcionSchema', () => {
  const base = {
    codigo: 'ACOMP',
    nombre: 'Acompañamiento',
    opciones: [{ nombre: 'Papas' }, { nombre: 'Yuca' }],
  };

  it('normaliza el código a mayúsculas', () => {
    expect(crearGrupoOpcionSchema.parse({ ...base, codigo: 'acomp_papas' }).codigo).toBe(
      'ACOMP_PAPAS',
    );
  });

  it('el costo extra por defecto es 0', () => {
    expect(crearGrupoOpcionSchema.parse(base).opciones[0].precio_extra).toBe(0);
  });

  it('rechaza máximo menor que mínimo', () => {
    expect(() => crearGrupoOpcionSchema.parse({ ...base, min_sel: 2, max_sel: 1 })).toThrow(
      /no puede ser menor que el mínimo/,
    );
  });

  it('un grupo obligatorio necesita mínimo 1', () => {
    expect(() =>
      crearGrupoOpcionSchema.parse({ ...base, obligatorio: true, min_sel: 0 }),
    ).toThrow(/al menos una selección/);
  });

  it('exige al menos una opción', () => {
    expect(() => crearGrupoOpcionSchema.parse({ ...base, opciones: [] })).toThrow();
  });
});

describe('actualizarGrupoOpcionSchema', () => {
  it('NO valida la coherencia entre campos: eso lo hace el servicio', () => {
    // Mandar solo `obligatorio` tiene que pasar. Una regla local lo rechazaría
    // por no ver el min_sel que ya está guardado — y activar "obligatorio" en un
    // grupo que ya tiene min_sel = 1 es una operación perfectamente válida.
    expect(() => actualizarGrupoOpcionSchema.parse({ obligatorio: true })).not.toThrow();
    expect(() => actualizarGrupoOpcionSchema.parse({ min_sel: 5 })).not.toThrow();
  });

  it('no deja cambiar el código: lo referencian el seed y los productos', () => {
    const r = actualizarGrupoOpcionSchema.parse({ codigo: 'OTRO', nombre: 'Nuevo' });
    expect('codigo' in r).toBe(false);
  });

  it('acepta el id de una opción existente para renombrarla', () => {
    const r = actualizarGrupoOpcionSchema.parse({
      opciones: [{ id: 3, nombre: 'Papas fritas', precio_extra: 500 }],
    });
    expect(r.opciones?.[0]).toMatchObject({ id: 3, nombre: 'Papas fritas', precio_extra: 500 });
  });
});

describe('interruptores', () => {
  it('cambiarActivoSchema solo acepta booleanos', () => {
    expect(cambiarActivoSchema.parse({ activo: false })).toEqual({ activo: false });
    expect(() => cambiarActivoSchema.parse({ activo: 'sí' })).toThrow();
    expect(() => cambiarActivoSchema.parse({ activo: 1 })).toThrow();
    expect(() => cambiarActivoSchema.parse({})).toThrow();
  });

  it('marcarAgotadoSchema solo acepta booleanos', () => {
    expect(marcarAgotadoSchema.parse({ agotado: true })).toEqual({ agotado: true });
    expect(() => marcarAgotadoSchema.parse({ agotado: 'no' })).toThrow();
  });
});
