import { describe, expect, it } from 'vitest';
import { COLORES_ESTADO } from './cocina';
import { HEX_PALETA_MESERAS, PALETA_MESERAS, buscarColorMesera, primerColorLibre } from './paleta';

// ── Utilidades de color, solo para verificar la paleta ──────────────────────

const canales = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const linealizar = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminancia = (hex: string) => {
  const [r, g, b] = canales(hex).map(linealizar);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Razón de contraste WCAG entre dos colores. */
const contraste = (a: string, b: string) => {
  const [l1, l2] = [luminancia(a), luminancia(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const aLab = (hex: string): [number, number, number] => {
  const [r, g, b] = canales(hex).map(linealizar);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

/** Distancia perceptual CIE76. Debajo de ~10 dos colores se confunden de un vistazo. */
const distancia = (a: string, b: string) => {
  const [l1, a1, b1] = aLab(a);
  const [l2, a2, b2] = aLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

// ── Los invariantes de la paleta ────────────────────────────────────────────

describe('PALETA_MESERAS', () => {
  it('tiene 10 colores', () => {
    expect(PALETA_MESERAS).toHaveLength(10);
  });

  it('no repite hex ni código', () => {
    expect(new Set(PALETA_MESERAS.map((c) => c.hex)).size).toBe(10);
    expect(new Set(PALETA_MESERAS.map((c) => c.codigo)).size).toBe(10);
  });

  it('todos los hex están en formato #RRGGBB en mayúsculas', () => {
    for (const color of PALETA_MESERAS) {
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(color.hexTenue).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('todos aguantan texto BLANCO encima con contraste AA (>= 4.5:1)', () => {
    for (const color of PALETA_MESERAS) {
      expect(contraste(color.hex, '#FFFFFF'), `${color.nombre} ${color.hex}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('los fondos tenues aguantan texto NEGRO con contraste AA', () => {
    for (const color of PALETA_MESERAS) {
      expect(contraste(color.hexTenue, '#111827'), `${color.nombre} tenue`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('están bien diferenciados entre sí (CIE76 >= 15)', () => {
    for (let i = 0; i < PALETA_MESERAS.length; i++) {
      for (let j = i + 1; j < PALETA_MESERAS.length; j++) {
        const [a, b] = [PALETA_MESERAS[i], PALETA_MESERAS[j]];
        expect(distancia(a.hex, b.hex), `${a.nombre} vs ${b.nombre}`).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('ningún color de mesera se confunde con un color de estado de cocina', () => {
    // Si el color de una mesera se leyera como "listo" o "agregado", la cocina
    // interpretaría mal la comanda de un vistazo.
    for (const color of PALETA_MESERAS) {
      for (const [estado, hexEstado] of Object.entries(COLORES_ESTADO)) {
        expect(distancia(color.hex, hexEstado), `${color.nombre} vs estado ${estado}`).toBeGreaterThanOrEqual(25);
      }
    }
  });
});

describe('buscarColorMesera', () => {
  it('encuentra sin importar mayúsculas', () => {
    expect(buscarColorMesera('#b91c1c')?.codigo).toBe('ROJO');
  });

  it('devuelve undefined si el hex no es de la paleta', () => {
    expect(buscarColorMesera('#123456')).toBeUndefined();
  });
});

describe('primerColorLibre', () => {
  it('sin colores tomados devuelve el primero', () => {
    expect(primerColorLibre([])?.codigo).toBe('ROJO');
  });

  it('salta los ya usados', () => {
    expect(primerColorLibre(['#B91C1C', '#92400E'])?.codigo).toBe('MOSTAZA');
  });

  it('con los 10 tomados devuelve undefined — admin debe avisar, no repetir', () => {
    expect(primerColorLibre(HEX_PALETA_MESERAS)).toBeUndefined();
  });
});
