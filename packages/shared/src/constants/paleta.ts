/**
 * PALETA_MESERAS — los 10 colores que identifican a cada mesera.
 *
 * Cada usuaria recibe uno al crearla. El color aparece como franja lateral gruesa
 * y fondo tenue en la tarjeta de sus cuentas, en la ficha de caja y en la comanda
 * de cocina.
 *
 * ⚠️ EL COLOR NUNCA ES LA ÚNICA SEÑAL. Siempre va acompañado del nombre de la
 * mesera en texto legible. Hay daltonismo, y la terraza recibe sol directo.
 *
 * Verificado (ver paleta.test.ts, que lo comprueba en cada corrida):
 * - Contraste >= 4.5:1 con texto BLANCO encima (WCAG AA). Mínimo real: 4.92:1.
 * - Distancia CIE76 >= 15 entre cualquier par. Mínimo real: 18.9.
 * - Distancia >= 25 contra los colores de estado de cocina (nuevo/agregado/
 *   preparación/listo), para que un color de mesera no se lea como un estado.
 */

export interface ColorMesera {
  /** Identificador estable. Es lo que se guarda si algún día se cambia el hex. */
  codigo: string;
  /** Nombre en español, para el selector del panel de admin. */
  nombre: string;
  /** Lo que va en `usuario.color_hex`. */
  hex: string;
  /** Mismo tono al 12% — el fondo tenue de la tarjeta. */
  hexTenue: string;
}

export const PALETA_MESERAS: readonly ColorMesera[] = [
  { codigo: 'ROJO', nombre: 'Rojo', hex: '#B91C1C', hexTenue: '#FEE2E2' },
  { codigo: 'TERRACOTA', nombre: 'Terracota', hex: '#92400E', hexTenue: '#FEF0E2' },
  { codigo: 'MOSTAZA', nombre: 'Mostaza', hex: '#A16207', hexTenue: '#FEF3C7' },
  { codigo: 'OLIVA', nombre: 'Oliva', hex: '#4D7C0F', hexTenue: '#ECFCCB' },
  { codigo: 'VERDE', nombre: 'Verde', hex: '#15803D', hexTenue: '#DCFCE7' },
  { codigo: 'TURQUESA', nombre: 'Turquesa', hex: '#0F766E', hexTenue: '#CCFBF1' },
  { codigo: 'CELESTE', nombre: 'Celeste', hex: '#0369A1', hexTenue: '#E0F2FE' },
  { codigo: 'AZUL', nombre: 'Azul', hex: '#1D4ED8', hexTenue: '#DBEAFE' },
  { codigo: 'VIOLETA', nombre: 'Violeta', hex: '#6D28D9', hexTenue: '#EDE9FE' },
  { codigo: 'ROSA', nombre: 'Rosa', hex: '#BE185D', hexTenue: '#FCE7F3' },
] as const;

/** Un color de la paleta con quién lo tiene, para el selector del panel de admin. */
export interface ColorPaletaEstado extends ColorMesera {
  libre: boolean;
  usado_por: { id: number; nombre: string } | null;
}

/** Los 10 hex, para validar `usuario.color_hex` contra la paleta. */
export const HEX_PALETA_MESERAS: readonly string[] = PALETA_MESERAS.map((c) => c.hex);

/** Color de una cuenta sin mesera responsable (típicamente PARA_LLEVAR, la abre caja). */
export const COLOR_SIN_MESERA = '#475569';
export const COLOR_SIN_MESERA_TENUE = '#F1F5F9';

export function buscarColorMesera(hex: string): ColorMesera | undefined {
  return PALETA_MESERAS.find((c) => c.hex.toUpperCase() === hex.toUpperCase());
}

/**
 * Primer color de la paleta que no esté tomado. `undefined` si ya se usaron los 10
 * — el panel de admin debe avisar en vez de repetir un color entre meseras activas.
 */
export function primerColorLibre(hexEnUso: readonly string[]): ColorMesera | undefined {
  const tomados = new Set(hexEnUso.map((h) => h.toUpperCase()));
  return PALETA_MESERAS.find((c) => !tomados.has(c.hex.toUpperCase()));
}
