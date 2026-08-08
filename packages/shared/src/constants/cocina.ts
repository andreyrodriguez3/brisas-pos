/**
 * Constantes de la pantalla de cocina.
 *
 * Las usuarias son señoras con poca experiencia digital, compartiendo una sola
 * tablet, con las manos ocupadas, en un ambiente caliente y con prisa.
 * Estos números no son preferencias de diseño: son requisitos de accesibilidad.
 */

/** Colores de estado. Se replican en `tailwind.config.js` como `estado-*`. */
export const COLORES_ESTADO = {
  /** NUEVOS — ámbar */
  nuevo: '#F59E0B',
  /** EN PREPARACIÓN — azul */
  preparacion: '#3B82F6',
  /** LISTOS — verde */
  listo: '#22C55E',
  /** Banda de los pedidos que se suman a una cuenta ya abierta — naranja */
  agregado: '#EA580C',
} as const;

/** Semáforo del temporizador de cada comanda. */
export const COLORES_URGENCIA = {
  normal: '#22C55E',
  alerta: '#F97316',
  urgente: '#DC2626',
} as const;

/**
 * Umbrales por defecto del temporizador, en minutos.
 * En tiempo de ejecución se leen de `configuracion` (MIN_ALERTA_COCINA /
 * MIN_URGENTE_COCINA); estos valores son el respaldo si la tabla no responde.
 */
export const MIN_ALERTA_COCINA_DEFAULT = 10;
export const MIN_URGENTE_COCINA_DEFAULT = 20;

export type NivelUrgencia = 'normal' | 'alerta' | 'urgente';

/** En qué nivel de urgencia está una comanda con `minutos` de espera. */
export function nivelUrgencia(
  minutos: number,
  minAlerta = MIN_ALERTA_COCINA_DEFAULT,
  minUrgente = MIN_URGENTE_COCINA_DEFAULT,
): NivelUrgencia {
  if (minutos >= minUrgente) return 'urgente';
  if (minutos >= minAlerta) return 'alerta';
  return 'normal';
}

/** Segundos que dura el botón DESHACER. No hay diálogos de confirmación. */
export const SEGUNDOS_DESHACER = 30;

/**
 * Mínimos táctiles y tipográficos de la escala `cocina`, en píxeles.
 * Espejo de lo configurado en `tailwind.config.js`.
 */
export const COCINA_UI = {
  /** Nombre del cliente en la comanda. */
  tamanoTitulo: 32,
  /** Platillos. */
  tamanoTextoBase: 24,
  /** Nada baja de aquí, nunca. */
  tamanoMinimo: 20,
  /** Alto mínimo de botón. Imposible errarle. */
  altoBoton: 80,
  /** Área táctil mínima. */
  areaTactil: 64,
  /** Separación entre botones. */
  separacion: 16,
} as const;
