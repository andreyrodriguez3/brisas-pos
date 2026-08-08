import type { Colones } from '../types/entidades';
import { exigirColones, exigirEnteroPositivo } from './colones';

/**
 * Divide `total` en `n` partes enteras que suman EXACTAMENTE `total`.
 *
 * Los colones sobrantes van a la PRIMERA parte. Regla explícita y estable:
 * la caja siempre sabe de antemano quién paga el colón de más, y la pantalla
 * muestra el desglose completo para que nadie tenga que hacer cuentas mentales.
 *
 *   dividirEnPartes(25000, 3) → [8334, 8333, 8333]
 *
 * @throws ErrorDeDinero si `total` no es entero >= 0 o `n` no es entero >= 1.
 */
export function dividirEnPartes(total: Colones, n: number): Colones[] {
  exigirColones(total, 'total');
  exigirEnteroPositivo(n, 'n (cantidad de partes)', 1);

  const base = Math.floor(total / n);
  const sobrante = total - base * n;

  const partes = new Array<number>(n).fill(base);
  partes[0] += sobrante;
  return partes;
}

/**
 * Reparte `total` en proporción a `pesos`, con enteros que suman EXACTAMENTE `total`.
 *
 * Usa el método del resto mayor: cada parte recibe el piso de su proporción y los
 * colones que sobran se entregan de uno en uno a las partes con mayor resto,
 * desempatando por posición (la primera gana). Determinista y auditable.
 *
 * Los pesos deben ser enteros >= 0 — quien llame convierte primero (ej.: horas a
 * minutos), así el reparto nunca depende de aritmética de punto flotante.
 *
 * Si todos los pesos son 0, cae en `dividirEnPartes`.
 */
export function repartirPorPesos(total: Colones, pesos: number[]): Colones[] {
  exigirColones(total, 'total');
  if (pesos.length === 0) return [];

  pesos.forEach((peso, i) => {
    if (!Number.isInteger(peso) || peso < 0) {
      throw new Error(`El peso en la posición ${i} debe ser un entero >= 0, llegó: ${peso}`);
    }
  });

  const pesoTotal = pesos.reduce((acc, p) => acc + p, 0);

  // DECISIÓN: sin pesos (nadie registró horas) no hay proporción posible.
  // Se reparte en partes iguales en vez de dejar el total sin asignar.
  if (pesoTotal === 0) return dividirEnPartes(total, pesos.length);

  const productos = pesos.map((peso) => total * peso);
  const partes = productos.map((producto) => Math.floor(producto / pesoTotal));
  const restos = productos.map((producto) => producto % pesoTotal);

  let faltante = total - partes.reduce((acc, p) => acc + p, 0);

  const ordenPorResto = restos
    .map((resto, indice) => ({ resto, indice }))
    .sort((a, b) => b.resto - a.resto || a.indice - b.indice);

  for (let i = 0; faltante > 0; i = (i + 1) % ordenPorResto.length) {
    partes[ordenPorResto[i].indice] += 1;
    faltante -= 1;
  }

  return partes;
}
