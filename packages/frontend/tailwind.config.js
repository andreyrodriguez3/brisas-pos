/**
 * Sistema de diseño de Brisas POS.
 *
 * Dos escalas de tamaño, porque los tres roles trabajan en condiciones distintas:
 *
 *   · Escala `cocina`  — tablet compartida, señoras con poca experiencia digital,
 *     manos ocupadas, ambiente caliente, prisa. Texto base 22 px, títulos 28 px+,
 *     botones de 72 px de alto, área táctil mínima de 64 px. NADA por debajo de
 *     20 px. Estos números son requisitos de accesibilidad, no preferencias.
 *
 *   · Escala normal — mesera (celular), caja y admin (pantalla grande, usuaria
 *     con más soltura técnica; ahí sí se puede densificar la información).
 *
 * Los colores de mesera NO están acá: viven en `PALETA_MESERAS` de
 * `@brisas/shared` y se aplican como estilo en línea, porque cada usuaria tiene
 * el suyo y Tailwind no puede generar clases dinámicas.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Estados de la comanda. Espejo de COLORES_ESTADO en @brisas/shared.
        estado: {
          nuevo: '#F59E0B',
          'nuevo-tenue': '#FEF3C7',
          preparacion: '#3B82F6',
          'preparacion-tenue': '#DBEAFE',
          listo: '#22C55E',
          'listo-tenue': '#DCFCE7',
          agregado: '#EA580C',
          'agregado-tenue': '#FFEDD5',
        },
        // Semáforo del temporizador de cocina.
        urgencia: {
          normal: '#22C55E',
          alerta: '#F97316',
          urgente: '#DC2626',
        },
        marca: {
          DEFAULT: '#15803D',
          oscuro: '#14532D',
          claro: '#DCFCE7',
        },
      },

      fontSize: {
        // ── Escala cocina ──────────────────────────────────────────────────
        // El tracking negativo en los tamaños grandes es a propósito: letras
        // muy separadas se leen "infladas". El cuerpo se deja en 0.
        //
        // Un escalón más chica que el mínimo original (cliente 32px, platillos
        // 24px) para que quepan más tarjetas por columna ahora que cocina
        // trabaja por platillo y no por comanda — hay más tarjetas por
        // pantalla que antes. El piso de 20px NO se toca: sigue siendo el
        // límite real de accesibilidad, no una preferencia.
        'cocina-xs': ['1.25rem', { lineHeight: '1.75rem' }], //  20 px — el piso, intocable
        'cocina-base': ['1.375rem', { lineHeight: '1.75rem' }], // 22 px — platillos
        'cocina-lg': ['1.625rem', { lineHeight: '2rem' }], //      26 px
        'cocina-titulo': ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.01em' }], // 28 px — cliente
        'cocina-xl': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.015em' }], //    36 px — columnas

        // ── Escala normal (mesera, caja, admin) ─────────────────────────────
        // Mismo criterio que cocina, pero más suave: acá el texto grande es un
        // título de sección o un monto, no el nombre del cliente a 32px+. Solo
        // se redefinen xl/2xl/3xl — el resto de la escala de Tailwind queda
        // igual, `letter-spacing: normal` sigue siendo lo correcto por debajo
        // de 20px.
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.005em' }], //  20 px
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }], //     24 px — montos y títulos de ficha
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.015em' }], // 30 px
      },

      spacing: {
        'boton-cocina': '4.5rem', // 72 px — alto mínimo de botón en cocina
        tactil: '4rem', //           64 px — área táctil mínima
        'sep-cocina': '1rem', //     16 px — separación entre botones
        'boton-normal': '3rem', //   48 px — alto mínimo en mesera/caja/admin
      },

      minHeight: {
        'boton-cocina': '4.5rem',
        tactil: '4rem',
        'boton-normal': '3rem',
      },

      minWidth: {
        tactil: '4rem',
      },

      keyframes: {
        // Parpadeo de la tarjeta al entrar una comanda nueva.
        'entrada-nueva': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: '#FEF3C7' },
        },
      },
      animation: {
        'entrada-nueva': 'entrada-nueva 1s ease-in-out 3',
      },
    },
  },
  plugins: [],
};
