import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // La lógica de dinero es la única con cobertura obligatoria: si el
      // redondeo está mal, las meseras cobran mal.
      include: ['src/money/**/*.ts'],
      // El barrel solo reexporta; medirlo bajaría el número sin decir nada.
      exclude: ['src/money/index.ts'],
      thresholds: { lines: 100, functions: 100, branches: 95, statements: 100 },
    },
  },
});
