import { describe, expect, it } from 'vitest';
import { PALETA_MESERAS } from '../constants/paleta';
import { Rol } from '../types/enums';
import { actualizarUsuarioSchema, crearUsuarioSchema } from './usuario';

const base = {
  nombre: 'Ana',
  rol: Rol.MESERA,
  pin: '1234',
  color_hex: PALETA_MESERAS[0].hex,
};

describe('crearUsuarioSchema', () => {
  it('acepta una mesera con un color de la paleta', () => {
    expect(crearUsuarioSchema.parse(base)).toMatchObject({ nombre: 'Ana', rol: 'MESERA' });
  });

  it('acepta el hex en minúsculas', () => {
    expect(() =>
      crearUsuarioSchema.parse({ ...base, color_hex: PALETA_MESERAS[0].hex.toLowerCase() }),
    ).not.toThrow();
  });

  it('rechaza un color que no está en la paleta', () => {
    // La paleta tiene contraste y separación perceptual verificados. Un color
    // suelto podría ser ilegible bajo el sol de la terraza o confundirse con
    // el de otra mesera.
    expect(() => crearUsuarioSchema.parse({ ...base, color_hex: '#123456' })).toThrow(
      /paleta de meseras/,
    );
  });

  it('exige un PIN de exactamente 4 dígitos', () => {
    expect(() => crearUsuarioSchema.parse({ ...base, pin: '123' })).toThrow(/4 dígitos/);
    expect(() => crearUsuarioSchema.parse({ ...base, pin: '12345' })).toThrow(/4 dígitos/);
    expect(() => crearUsuarioSchema.parse({ ...base, pin: 'abcd' })).toThrow(/4 dígitos/);
  });

  it('rechaza un rol inventado', () => {
    expect(() => crearUsuarioSchema.parse({ ...base, rol: 'GERENTE' })).toThrow();
  });

  it('exige un nombre de al menos 2 letras', () => {
    expect(() => crearUsuarioSchema.parse({ ...base, nombre: 'A' })).toThrow();
  });
});

describe('actualizarUsuarioSchema', () => {
  it('todo es opcional: se puede mandar solo el nombre', () => {
    expect(actualizarUsuarioSchema.parse({ nombre: 'Ana María' })).toEqual({ nombre: 'Ana María' });
  });

  it('permite cambiar solo el PIN', () => {
    expect(actualizarUsuarioSchema.parse({ pin: '9999' })).toEqual({ pin: '9999' });
  });

  it('sigue validando lo que sí viene', () => {
    expect(() => actualizarUsuarioSchema.parse({ pin: '99' })).toThrow();
    expect(() => actualizarUsuarioSchema.parse({ color_hex: '#000000' })).toThrow();
  });

  it('acepta el interruptor de activo', () => {
    expect(actualizarUsuarioSchema.parse({ activo: false })).toEqual({ activo: false });
  });
});
