#!/usr/bin/env node
/**
 * Genera el JWT_SECRET de la instalación.
 *
 *   npm run secreto            → lo imprime para copiarlo a mano
 *   npm run secreto:escribir   → lo escribe en packages/backend/.env
 *
 * (Son dos scripts y no una bandera porque `npm run … -- --escribir` se la come
 * npm en Windows y el archivo nunca se escribiría.)
 *
 * Existe porque "poné una cadena larga y aleatoria" en un manual termina, sin
 * falta, en un secreto tecleado a mano el día de la instalación. Quien tenga
 * este valor puede fabricarse un token de administradora desde cualquier
 * celular del WiFi, sin saber ningún PIN.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = join(RAIZ, 'packages', 'backend', '.env');

// 48 bytes en base64url: 64 caracteres, sin comillas ni signos que rompan el .env.
const secreto = randomBytes(48).toString('base64url');
const escribir = process.argv.includes('--escribir');

if (!escribir) {
  console.log('\nJWT_SECRET nuevo:\n');
  console.log(`JWT_SECRET="${secreto}"\n`);
  console.log('Pegalo en packages/backend/.env, o volvé a correr con --escribir.\n');
  process.exit(0);
}

if (!existsSync(ENV)) {
  console.error(`\nNo existe ${ENV}.`);
  console.error('Copiá .env.example a packages/backend/.env primero.\n');
  process.exit(1);
}

const antes = readFileSync(ENV, 'utf8');
const linea = `JWT_SECRET="${secreto}"`;

const despues = /^JWT_SECRET=.*$/m.test(antes)
  ? antes.replace(/^JWT_SECRET=.*$/m, linea)
  : `${antes.trimEnd()}\n${linea}\n`;

writeFileSync(ENV, despues, 'utf8');

console.log(`\n✓ JWT_SECRET nuevo escrito en packages/backend/.env`);
console.log('  Reiniciá el backend para que tome efecto.');
// Cambiar el secreto invalida los tokens ya emitidos: es la consecuencia
// esperada, pero conviene decirla antes de que alguien crea que se rompió algo.
console.log('  ⚠️ Todas las sesiones abiertas se cierran: hay que volver a marcar el PIN,');
console.log('     y la tablet de cocina pide su token sola al recargar.\n');
