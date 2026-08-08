import { describe, expect, it } from 'vitest';
import { LARGO_MINIMO_SECRETO, esSecretoDeEjemplo, validarSecretoJwt } from './secreto';

const bueno = 'x'.repeat(LARGO_MINIMO_SECRETO);

describe('esSecretoDeEjemplo', () => {
  it('reconoce el valor que trae .env.example', () => {
    expect(esSecretoDeEjemplo('cambiar-esto-por-una-cadena-larga-y-aleatoria')).toBe(true);
  });

  it('reconoce el de desarrollo', () => {
    expect(esSecretoDeEjemplo('desarrollo-local-cambiar-en-produccion')).toBe(true);
  });

  it('no se deja engañar por mayúsculas ni espacios', () => {
    expect(esSecretoDeEjemplo('  CHANGEME  ')).toBe(true);
  });

  it('un secreto de verdad no es de ejemplo', () => {
    expect(esSecretoDeEjemplo(bueno)).toBe(false);
  });
});

describe('validarSecretoJwt — producción', () => {
  it('no arranca sin secreto', () => {
    expect(() => validarSecretoJwt(undefined, 'production')).toThrow(/Falta JWT_SECRET/);
  });

  it('no arranca con el secreto vacío', () => {
    expect(() => validarSecretoJwt('   ', 'production')).toThrow(/Falta JWT_SECRET/);
  });

  it('NO ARRANCA con el .env copiado tal cual del ejemplo', () => {
    // Es el error más fácil de cometer el día de la instalación, y el que no se
    // nota: todo funcionaría perfecto salvo que cualquiera en el WiFi podría
    // fabricarse un token de administradora.
    expect(() => validarSecretoJwt('cambiar-esto-por-una-cadena-larga-y-aleatoria', 'production'))
      .toThrow(/valor de ejemplo/);
  });

  it('no arranca con un secreto corto', () => {
    expect(() => validarSecretoJwt('abc123', 'production')).toThrow(/muy corto/);
  });

  it('el error dice cómo arreglarlo', () => {
    expect(() => validarSecretoJwt('abc123', 'production')).toThrow(/npm run secreto:escribir/);
  });

  it('con un secreto de verdad arranca y lo devuelve tal cual', () => {
    expect(validarSecretoJwt(bueno, 'production')).toBe(bueno);
  });
});

describe('validarSecretoJwt — desarrollo', () => {
  it('avisa pero deja trabajar: frenar el npm run dev no protege a nadie', () => {
    expect(validarSecretoJwt('desarrollo-local-cambiar-en-produccion', 'development')).toBe(
      'desarrollo-local-cambiar-en-produccion',
    );
  });

  it('la falta total de secreto sí frena, incluso en desarrollo', () => {
    // Sin secreto no hay nada que firmar: no es una advertencia, es un error.
    expect(() => validarSecretoJwt(undefined, 'development')).toThrow(/Falta JWT_SECRET/);
  });
});
