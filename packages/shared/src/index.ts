/**
 * @brisas/shared — el contrato único entre backend y frontend.
 *
 * Si un tipo, una validación o un cálculo de dinero se necesita en los dos lados,
 * vive acá y en ningún otro lugar.
 */

// Tipos y enums del dominio
export * from './types/enums';
export * from './types/entidades';
export * from './types/realtime';

// Aritmética de dinero — colones enteros, redondeo explícito, reparto
export * from './money';

// Constantes
export * from './constants/paleta';
export * from './constants/cocina';
export * from './constants/configuracion';

// Orden y urgencia de la cola de cocina
export * from './cocina/cola';

// Schemas Zod compartidos
export * from './schemas/comunes';
export * from './schemas/auth';
export * from './schemas/usuario';
export * from './schemas/menu';
export * from './schemas/cuenta';
export * from './schemas/pedido';
export * from './schemas/cobro';
export * from './schemas/turno';
export * from './schemas/configuracion';
