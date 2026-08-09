/**
 * Sistema de diseño de Brisas POS.
 *
 * Dos escalas de tamaño, porque los tres roles trabajan en condiciones distintas:
 *
 *   · Escala `cocina`  — tablet compartida, señoras con poca experiencia digital,
 *     manos ocupadas, ambiente caliente, prisa. Texto base 24 px, títulos 32 px+,
 *     botones de 80 px de alto, área táctil mínima de 64 px. NADA por debajo de
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
        // muy separadas a 32px+ se leen "infladas". El cuerpo se deja en 0.
        'cocina-xs': ['1.25rem', { lineHeight: '1.75rem' }], // 20 px — el piso
        'cocina-base': ['1.5rem', { lineHeight: '2rem' }], //    24 px — platillos
        'cocina-lg': ['1.75rem', { lineHeight: '2.25rem' }], //  28 px
        'cocina-titulo': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.01em' }], //  32 px — cliente
        'cocina-xl': ['2.5rem', { lineHeight: '3rem', letterSpacing: '-0.015em' }], //      40 px — columnas
      },

      spacing: {
        'boton-cocina': '5rem', //  80 px — alto mínimo de botón en cocina
        tactil: '4rem', //          64 px — área táctil mínima
        'sep-cocina': '1rem', //    16 px — separación entre botones
        'boton-normal': '3rem', //  48 px — alto mínimo en mesera/caja/admin
      },

      minHeight: {
        'boton-cocina': '5rem',
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
