import { Logger } from '@nestjs/common';

/**
 * El secreto con el que se firman los JWT.
 *
 * Quien tenga este valor puede fabricarse un token de ADMIN y cobrar, anular y
 * borrar precios desde cualquier celular conectado al WiFi del restaurante. No
 * hace falta saber ningún PIN: el token *es* la sesión.
 *
 * Por eso el sistema se niega a arrancar en producción con el valor de ejemplo.
 * Un `.env` copiado tal cual del `.env.example` es el error más fácil de cometer
 * el día de la instalación, y el que no se nota — todo funcionaría perfecto.
 */

/** Lo que trae `.env.example` y cualquier variante obvia de "todavía no lo cambié". */
const VALORES_DE_EJEMPLO = [
  'cambiar-esto-por-una-cadena-larga-y-aleatoria',
  'desarrollo-local-cambiar-en-produccion',
  'secret',
  'changeme',
  'cambiar',
];

/** 32 caracteres. Con menos, adivinarlo por fuerza bruta deja de ser absurdo. */
export const LARGO_MINIMO_SECRETO = 32;

export function esSecretoDeEjemplo(secreto: string): boolean {
  return VALORES_DE_EJEMPLO.includes(secreto.trim().toLowerCase());
}

/**
 * Revisa el secreto antes de que el sistema quede en pie.
 *
 * En producción tira y no arranca. En desarrollo solo avisa: frenar el
 * `npm run dev` de la máquina de Andrey no protege a nadie y estorba.
 */
export function validarSecretoJwt(secreto: string | undefined, entorno: string): string {
  const log = new Logger('Auth');
  const produccion = entorno === 'production';

  if (!secreto || secreto.trim() === '') {
    throw new Error(
      'Falta JWT_SECRET en el .env. Generá uno con «npm run secreto» y volvé a arrancar.',
    );
  }

  const problema = esSecretoDeEjemplo(secreto)
    ? 'JWT_SECRET todavía tiene el valor de ejemplo'
    : secreto.length < LARGO_MINIMO_SECRETO
      ? `JWT_SECRET es muy corto (${secreto.length} caracteres, mínimo ${LARGO_MINIMO_SECRETO})`
      : null;

  if (problema) {
    const comoArreglarlo = 'Generá uno con «npm run secreto:escribir».';
    if (produccion) {
      throw new Error(
        `${problema}. Con este valor cualquiera en la red del restaurante puede fabricarse ` +
          `un token de administradora sin saber ningún PIN. ${comoArreglarlo}`,
      );
    }
    log.warn(`${problema}. Está bien para desarrollo, NO para la PC de caja. ${comoArreglarlo}`);
  }

  return secreto;
}
