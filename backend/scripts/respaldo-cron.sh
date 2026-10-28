#!/usr/bin/env bash
# Respaldo diario de la base y de uploads.
# Instalación sugerida en /etc/cron.d/clasesespejo:
#   15 2 * * * clasesespejo /opt/clasesespejo/backend/scripts/respaldo-cron.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${RESPALDO_DIR:-/var/backups/clasesespejo}"
FECHA="$(date +%F-%H%M)"

mkdir -p "$DESTINO"
cd "$RAIZ"

# El script existente genera base.dump, uploads/ y respaldo.json.
npm run respaldo -- --salida "$DESTINO/$FECHA" >>"$DESTINO/respaldo.log" 2>&1

echo "$(date -Is) respaldo OK: $DESTINO/$FECHA" >>"$DESTINO/respaldo.log"
