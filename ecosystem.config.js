/**
 * PM2 — arranque automático del backend en la PC de caja.
 *
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup          (Linux/macOS)
 *
 * Rotación de logs (una sola vez, si no el disco se llena en unos meses):
 *   pm2 install pm2-logrotate
 *   pm2 set pm2-logrotate:max_size 10M
 *   pm2 set pm2-logrotate:retain 30
 *   pm2 set pm2-logrotate:compress true
 *   pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
 *
 * En Windows PM2 no registra servicios de forma confiable: usá NSSM.
 * Ver `scripts/instalacion-windows.md`.
 */
module.exports = {
  apps: [
    {
      name: 'brisas-pos',
      script: './packages/backend/dist/main.js',
      cwd: __dirname,
      instances: 1,
      // SQLite es un archivo único: una sola instancia escribe. Nunca cluster.
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 3000,
      },
      error_file: './logs/brisas-error.log',
      out_file: './logs/brisas-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Si el proceso muere en cadena, esperar antes de reintentar.
      restart_delay: 3000,
      max_restarts: 20,
      // Se considera "arrancado bien" recién a los 10 s: así un crash en el
      // arranque no cuenta como reinicio exitoso y PM2 termina frenando.
      min_uptime: 10_000,
      // Tiempo para cerrar la conexión de SQLite antes del kill -9.
      kill_timeout: 5_000,
    },
  ],
};
