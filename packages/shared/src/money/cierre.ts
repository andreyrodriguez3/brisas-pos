import type { CanalCuenta, ReglaReparto } from '../types/enums';
import type { Colones } from '../types/entidades';
import { calcularTotalLinea, totalizadorDeLinea, type LineaCobrable } from './lineas';
import {
  repartirPartesIguales,
  repartirPorAtribucion,
  repartirPorHoras,
  type ParteReparto,
} from './reparto';

/**
 * El cierre del día.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  Los tres totalizadores son INDEPENDIENTES y ninguna línea de comida
 *  cambia de bolsa jamás. La separación es POR CUENTA, según su canal.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Fijate en `LineaDeCierre`: **no tiene `para_llevar`**. No es un olvido — es
 * la defensa. Que a Don Carlos le sobre medio casado y se lo lleve no mueve ni
 * ₡1 de la bolsa de salón: solo agrega una línea de envase, que sí va a la
 * bolsa de envases. Si te encontrás queriendo agregarle ese campo acá, lo que
 * estás escribiendo está mal (sección 5.7 del plan de trabajo).
 */

/**
 * Una línea, para efectos del cierre.
 * Lo único que decide su bolsa es `es_envase` — y el canal de SU CUENTA.
 */
export interface LineaDeCierre extends LineaCobrable {
  es_envase: boolean;
}

export interface CuentaDeCierre {
  /** LO ÚNICO que clasifica ingresos. */
  canal: CanalCuenta;
  /** Quién la abrió. null en PARA_LLEVAR: su venta no es de nadie del salón. */
  mesera_responsable_id: number | null;
  lineas: ReadonlyArray<LineaDeCierre>;
  /** Lo que se descontó en esta cuenta, ya calculado por `aplicarDescuentos`. */
  descuento?: Colones;
}

/** Las tres bolsas. Se muestran siempre por separado. */
export interface Totalizadores {
  /** Atribuible a las meseras. */
  salon: Colones;
  /** Cuenta aparte de la dueña. */
  para_llevar: Colones;
  /** Recuperación de empaque, de cualquier canal. */
  envases: Colones;
}

/** Suma las cuentas en sus tres bolsas. Las anuladas no se pasan a esta función. */
export function totalizarCuentas(cuentas: ReadonlyArray<CuentaDeCierre>): Totalizadores {
  const totales: Totalizadores = { salon: 0, para_llevar: 0, envases: 0 };

  for (const cuenta of cuentas) {
    for (const linea of cuenta.lineas) {
      const monto = calcularTotalLinea(linea);
      if (monto === 0) continue;

      // El punto único de la separación contable. No recibe `para_llevar`.
      switch (totalizadorDeLinea(cuenta.canal, linea.es_envase)) {
        case 'SALON':
          totales.salon += monto;
          break;
        case 'PARA_LLEVAR':
          totales.para_llevar += monto;
          break;
        case 'ENVASES':
          totales.envases += monto;
          break;
      }
    }
  }

  return totales;
}

/**
 * Ventas de salón atribuidas a cada mesera: el total de las cuentas que ella
 * abrió, sin contar envases — el empaque no es venta suya.
 *
 * Las cuentas PARA_LLEVAR no entran: no tienen mesera responsable y su venta va
 * a la cuenta aparte de la dueña.
 */
export function ventasPorMesera(
  cuentas: ReadonlyArray<CuentaDeCierre>,
  meserasIds: readonly number[],
): Array<{ usuario_id: number; ventas: Colones }> {
  const porMesera = new Map<number, Colones>(meserasIds.map((id) => [id, 0]));

  for (const cuenta of cuentas) {
    if (cuenta.mesera_responsable_id === null) continue;
    if (!porMesera.has(cuenta.mesera_responsable_id)) continue;

    for (const linea of cuenta.lineas) {
      if (totalizadorDeLinea(cuenta.canal, linea.es_envase) !== 'SALON') continue;
      porMesera.set(
        cuenta.mesera_responsable_id,
        (porMesera.get(cuenta.mesera_responsable_id) ?? 0) + calcularTotalLinea(linea),
      );
    }
  }

  return meserasIds.map((usuario_id) => ({ usuario_id, ventas: porMesera.get(usuario_id) ?? 0 }));
}

export interface MeseraDelTurno {
  usuario_id: number;
  horas: number;
}

export interface RepartoMesera {
  usuario_id: number;
  horas_trabajadas: number;
  ventas_atribuidas: Colones;
  /** Regla A: se lleva lo de sus propias cuentas. */
  monto_atribucion: Colones;
  /** Regla B: proporcional a las horas. */
  monto_horas: Colones;
  /** Regla C: el total entre todas. */
  monto_partes_iguales: Colones;
}

export interface DesgloseReparto {
  /**
   * Lo que se reparte en las reglas B y C.
   *
   * DECISIÓN: es el total de SALÓN. Para llevar es la cuenta aparte de la dueña
   * (sección 5.8) y los envases son recuperación de empaque, no venta de nadie.
   * Se expone en el desglose para que la dueña vea exactamente qué se dividió,
   * en vez de tener que confiar en un número final.
   */
  base_reparto: Colones;
  regla_aplicada: ReglaReparto;
  meseras: RepartoMesera[];
}

/**
 * Los TRES repartos, siempre.
 *
 * La regla activa la dice `configuracion.REGLA_REPARTO`, pero el cierre calcula
 * y muestra las tres lado a lado: la dueña todavía no decidió cuál usar cuando
 * hay dos o más meseras, y esa decisión se toma mejor viendo números reales que
 * en abstracto.
 */
export function calcularReparto(
  cuentas: ReadonlyArray<CuentaDeCierre>,
  meseras: ReadonlyArray<MeseraDelTurno>,
  reglaAplicada: ReglaReparto,
): DesgloseReparto {
  const ids = meseras.map((m) => m.usuario_id);
  const ventas = ventasPorMesera(cuentas, ids);
  const base = totalizarCuentas(cuentas).salon;

  const porAtribucion = indexar(repartirPorAtribucion(ventas));
  const porHoras = indexar(repartirPorHoras(base, meseras.map((m) => ({ usuario_id: m.usuario_id, horas: m.horas }))));
  const iguales = meseras.length > 0 ? repartirPartesIguales(base, meseras.length) : [];

  return {
    base_reparto: base,
    regla_aplicada: reglaAplicada,
    meseras: meseras.map((m, i) => ({
      usuario_id: m.usuario_id,
      horas_trabajadas: m.horas,
      ventas_atribuidas: ventas[i].ventas,
      monto_atribucion: porAtribucion.get(m.usuario_id) ?? 0,
      monto_horas: porHoras.get(m.usuario_id) ?? 0,
      monto_partes_iguales: iguales[i] ?? 0,
    })),
  };
}

/** El monto que manda hoy, según la regla activa. */
export function montoSegunRegla(mesera: RepartoMesera, regla: ReglaReparto): Colones {
  switch (regla) {
    case 'HORAS':
      return mesera.monto_horas;
    case 'PARTES_IGUALES':
      return mesera.monto_partes_iguales;
    default:
      return mesera.monto_atribucion;
  }
}

function indexar(partes: ParteReparto[]): Map<number, Colones> {
  return new Map(partes.map((p) => [p.usuario_id, p.monto]));
}
