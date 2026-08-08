#!/usr/bin/env bash
#
# Respaldo de la base de datos de Brisas POS (Linux/macOS).
#
# Copia el archivo SQLite con marca de tiempo a una carpeta local y, si está
# montada, a una llave USB. Retiene 30 días.
#
# Usa `sqlite3 .backup` si está disponible: es la forma correcta de copiar una
# base en WAL mientras el sistema está trabajando.
#
#   ./scripts/backup.sh
#
# Programarlo diario con cron:
#   30 23 * * *  /ruta/a/brisas-pos/scripts/backup.sh >> /var/log/brisas-backup.log 2>&1
#
# ─────────────────────────────────────────────────────────────────────────────
# RESTAURACIÓN — probala durante la instalación, no el día que haga falta:
#
#   1. pm2 stop brisas-pos
#   2. mv data/brisas.sqlite data/brisas.sqlite.roto
#      rm -f data/brisas.sqlite-wal data/brisas.sqlite-shm
#   3. cp respaldos/brisas_AAAA-MM-DD_HHMM.sqlite data/brisas.sqlite
#   4. pm2 start brisas-pos
#   5. curl http://localhost:3000/api/health   → {"ok":true,...}
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BASE_DATOS="${BASE_DATOS:-$RAIZ/packages/backend/data/brisas.sqlite}"
DESTINO_LOCAL="${DESTINO_LOCAL:-$RAIZ/respaldos}"
# Punto de montaje de la llave USB que queda conectada permanentemente.
DESTINO_USB="${DESTINO_USB:-/media/usb/BrisasPOS/respaldos}"
DIAS_RETENCION="${DIAS_RETENCION:-30}"

escribir() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if [[ ! -f "$BASE_DATOS" ]]; then
  escribir "ERROR: no se encontró la base en $BASE_DATOS"
  exit 1
fi

MARCA="$(date '+%Y-%m-%d_%H%M')"
NOMBRE="brisas_${MARCA}.sqlite"

mkdir -p "$DESTINO_LOCAL"
PRIMERO="$DESTINO_LOCAL/$NOMBRE"

# ── Copia ────────────────────────────────────────────────────────────────────

if command -v sqlite3 >/dev/null 2>&1; then
  # Copia consistente en caliente, sin detener el servicio.
  sqlite3 "$BASE_DATOS" ".backup '$PRIMERO'"
  escribir "Respaldo con sqlite3 .backup → $PRIMERO"
else
  cp "$BASE_DATOS" "$PRIMERO"
  for sufijo in -wal -shm; do
    [[ -f "${BASE_DATOS}${sufijo}" ]] && cp "${BASE_DATOS}${sufijo}" "${PRIMERO}${sufijo}"
  done
  escribir "Respaldo por copia de archivos → $PRIMERO"
  escribir "  (instalá sqlite3 para respaldos en caliente más seguros)"
fi

DESTINOS=("$DESTINO_LOCAL")

if [[ -d "$(dirname "$DESTINO_USB")" ]]; then
  mkdir -p "$DESTINO_USB"
  cp "$PRIMERO" "$DESTINO_USB/$NOMBRE"
  for sufijo in -wal -shm; do
    [[ -f "${PRIMERO}${sufijo}" ]] && cp "${PRIMERO}${sufijo}" "$DESTINO_USB/${NOMBRE}${sufijo}"
  done
  DESTINOS+=("$DESTINO_USB")
  escribir "Copiado a $DESTINO_USB"
else
  # Aviso, no error: la copia local igual se hizo.
  escribir "AVISO: la llave USB no está montada ($DESTINO_USB). Solo respaldo local."
fi

# ── Retención ────────────────────────────────────────────────────────────────

BORRADOS=0
for destino in "${DESTINOS[@]}"; do
  while IFS= read -r -d '' viejo; do
    rm -f "$viejo"
    BORRADOS=$((BORRADOS + 1))
  done < <(find "$destino" -maxdepth 1 -name 'brisas_*.sqlite*' -mtime "+$DIAS_RETENCION" -print0)
done
escribir "Retención: $BORRADOS archivo(s) de más de $DIAS_RETENCION días eliminados"

escribir "Listo. Tamaño: $(du -h "$PRIMERO" | cut -f1)"
