import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: {
      // El frontend consume @brisas/shared desde la FUENTE, no desde dist/.
      //
      // `shared` compila a CommonJS para NestJS, y en CommonJS un `export *` se
      // vuelve `__exportStar(...)`, que Rollup no puede analizar estáticamente:
      // el build falla con "X is not exported by shared/dist/index.js".
      // Apuntando a src/, Vite transpila el TypeScript directo y de paso el
      // frontend nunca queda con un dist viejo.
      '@brisas/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Sin tiendas: la mesera instala la app desde el navegador del celular.
      manifest: {
        name: 'Brisas POS',
        short_name: 'Brisas',
        description: 'Pedidos y caja — Mirador Brisas del Monte',
        lang: 'es-CR',
        theme_color: '#15803D',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        // PENDIENTE antes del piloto: reemplazar por PNG de 192 y 512 px con el
        // logo real del restaurante. Android instala con SVG, pero algunos
        // lanzadores no lo escalan bien en la pantalla de inicio.
        icons: [
          { src: '/icono.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // El shell queda cacheado: si el WiFi parpadea, la app abre igual y
        // muestra su banner de sin conexión en vez de una pantalla en blanco.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
        // Los datos NUNCA se cachean: un pedido viejo en pantalla es peor que
        // un error visible.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    // Para probar desde el celular contra la máquina de desarrollo.
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
