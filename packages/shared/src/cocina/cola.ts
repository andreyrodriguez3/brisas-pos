import {
  MIN_ALERTA_COCINA_DEFAULT,
  MIN_URGENTE_COCINA_DEFAULT,
  nivelUrgencia,
  type NivelUrgencia,
} from '../constants/cocina';

/**
 * Orden y urgencia de la cola de cocina.
 *
 * Vive en `shared` y no en la pantalla porque son reglas del negocio, no
 * decisiones de diseño: cuál comanda va arriba y cuándo se pone roja se prueba
 * con tests, no se descubre en plena hora pico.
 *
 * Nadie en cocina debe tener que buscar nada. La lista se ordena sola y el
 * semáforo hace el trabajo de decidir a qué prestarle atención.
 */

export interface UmbralesCocina {
  /** Minutos para pasar a naranja. Sale de `configuracion.MIN_ALERTA_COCINA`. */
  alerta: number;
  /** Minutos para pasar a rojo. Sale de `configuracion.MIN_URGENTE_COCINA`. */
  urgente: number;
}

export const UMBRALES_POR_DEFECTO: UmbralesCocina = {
  alerta: MIN_ALERTA_COCINA_DEFAULT,
  urgente: MIN_URGENTE_COCINA_DEFAULT,
};

/** Lo mínimo que hace falta de una comanda para ordenarla y pintarle el reloj. */
export interface ComandaOrdenable {
  consecutivo_dia: number;
  creado_en: string;
  /** Solo las cuentas PARA_LLEVAR la tienen. */
  hora_retiro?: string | null;
  /** La cuenta ya tenía pedidos cuando se mandó este: hay un cliente sentado esperando. */
  es_agregado: boolean;
}

/**
 * El momento contra el que se mide la comanda, en milisegundos.
 *
 * Para una cuenta de salón es su hora de entrada: la cocina la empieza cuanto
 * antes. Para una PARA_LLEVAR es la **hora de retiro** — el cliente dijo que
 * pasa a las 6, y una comanda que entró a las 3 para las 6 no debe estar
 * ocupando el primer lugar toda la tarde.
 *
 * DECISIÓN: las dos van a un mismo eje de tiempo — "qué toca primero" — en vez
 * de tener dos listas separadas. Cocina mira una sola columna y lo de arriba es
 * lo que sigue, sin traducir nada mentalmente.
 */
export function momentoDeReferencia(comanda: ComandaOrdenable): number {
  const referencia = comanda.hora_retiro ?? comanda.creado_en;
  return new Date(referencia).getTime();
}

/**
 * Ordena la cola: lo que toca primero, arriba.
 *
 * DECISIÓN: antes de mirar el tiempo, se compara `es_agregado`. Una comanda
 * agregada es de un cliente que YA está sentado comiendo y pidió algo más —
 * hacerlo esperar detrás de mesas nuevas que recién llegaron no tiene sentido,
 * así que los agregados van siempre arriba de los nuevos, sin importar cuánto
 * lleven esperando esos otros. Dentro de cada grupo (agregados entre sí, nuevos
 * entre sí) se sigue ordenando exactamente como antes: por `momentoDeReferencia`
 * y, si empatan, por `consecutivo_dia`.
 *
 * Devuelve un arreglo nuevo — no toca el original, que suele venir del caché de
 * React Query. Los empates se rompen por número de comanda, que es el orden en
 * que entraron: así la lista nunca "baila" entre dos renders.
 */
export function ordenarCola<T extends ComandaOrdenable>(comandas: readonly T[]): T[] {
  return [...comandas].sort((a, b) => {
    const porAgregado = Number(b.es_agregado) - Number(a.es_agregado);
    if (porAgregado !== 0) return porAgregado;

    const diferencia = momentoDeReferencia(a) - momentoDeReferencia(b);
    return diferencia !== 0 ? diferencia : a.consecutivo_dia - b.consecutivo_dia;
  });
}

/**
 * Minutos que la comanda lleva esperando.
 *
 * `ahora` se recibe como parámetro a propósito: la tablet de cocina puede tener
 * la hora mal y en pantalla se usa la del servidor (INVARIANTE 6). Pasarla por
 * argumento también es lo que hace esto testeable sin congelar relojes.
 */
export function minutosDeEspera(comanda: ComandaOrdenable, ahora: number): number {
  const transcurridos = (ahora - new Date(comanda.creado_en).getTime()) / 60_000;
  return Math.max(0, Math.floor(transcurridos));
}

/**
 * Minutos que faltan para la hora de retiro. Negativo si ya pasó.
 * `null` si la comanda no es de una cuenta PARA_LLEVAR con hora.
 */
export function minutosParaRetiro(comanda: ComandaOrdenable, ahora: number): number | null {
  if (!comanda.hora_retiro) return null;
  return Math.floor((new Date(comanda.hora_retiro).getTime() - ahora) / 60_000);
}

/**
 * El semáforo de la tarjeta.
 *
 * Son dos preguntas distintas según el canal, y confundirlas pintaría de rojo
 * cosas que no lo son:
 *
 *   · Salón — *¿cuánto lleva esperando el cliente?* Naranja a los 10 minutos,
 *     rojo a los 20 (los umbrales salen de `configuracion`).
 *   · Para llevar — *¿cuánto falta para que venga a recogerlo?* Un pedido que
 *     entró a las 3 para las 6 lleva tres horas "esperando" y no tiene nada de
 *     urgente; lo que importa es que salga a tiempo. Se pone naranja cuando
 *     faltan los minutos del umbral urgente (ya debería estar en el fuego) y
 *     rojo cuando faltan los del umbral de alerta o la hora ya pasó.
 */
export function urgenciaDeComanda(
  comanda: ComandaOrdenable,
  ahora: number,
  umbrales: UmbralesCocina = UMBRALES_POR_DEFECTO,
): NivelUrgencia {
  const faltan = minutosParaRetiro(comanda, ahora);

  if (faltan === null) {
    return nivelUrgencia(minutosDeEspera(comanda, ahora), umbrales.alerta, umbrales.urgente);
  }

  if (faltan <= umbrales.alerta) return 'urgente';
  if (faltan <= umbrales.urgente) return 'alerta';
  return 'normal';
}
