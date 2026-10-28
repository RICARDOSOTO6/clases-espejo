#!/usr/bin/env bash
# Instala y activa los temporizadores de respaldo y salud de Clases Conjuntas.
#
# Uso, dentro de la VM y desde la raíz del paquete:
#   sudo /opt/clasesespejo/backend/scripts/instalar-temporizadores.sh
#
# Es idempotente: se puede volver a ejecutar sin duplicar nada.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO_SYSTEMD="/etc/systemd/system"
USUARIO="${CLASESESPEJO_USUARIO:-clasesespejo}"
RESPALDOS="${RESPALDO_DIR:-/var/backups/clasesespejo}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este instalador con sudo." >&2
  exit 1
fi
if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl no está disponible; este instalador es para Ubuntu con systemd." >&2
  exit 1
fi
if ! systemctl cat clasesespejo.service >/dev/null 2>&1; then
  echo "No existe clasesespejo.service. Instala primero el servicio del backend." >&2
  exit 1
fi
if ! id "$USUARIO" >/dev/null 2>&1; then
  echo "No existe el usuario del servicio: $USUARIO." >&2
  exit 1
fi

chmod 750 "$DIR/respaldo-cron.sh"
chmod 644 "$DIR/clasesespejo-respaldo.service" "$DIR/clasesespejo-respaldo.timer"
chmod 644 "$DIR/clasesespejo-salud.service" "$DIR/clasesespejo-salud.timer"

install -m 0644 "$DIR/clasesespejo-respaldo.service" "$DESTINO_SYSTEMD/"
install -m 0644 "$DIR/clasesespejo-respaldo.timer" "$DESTINO_SYSTEMD/"
install -m 0644 "$DIR/clasesespejo-salud.service" "$DESTINO_SYSTEMD/"
install -m 0644 "$DIR/clasesespejo-salud.timer" "$DESTINO_SYSTEMD/"

mkdir -p "$RESPALDOS"
chown "$USUARIO:$USUARIO" "$RESPALDOS"
chmod 750 "$RESPALDOS"

systemctl daemon-reload
systemctl enable --now clasesespejo-respaldo.timer
systemctl enable --now clasesespejo-salud.timer

echo
echo "Temporizadores instalados:"
systemctl list-timers --all | grep -E 'clasesespejo|NEXT' || true
echo
echo "Respaldo: $RESPALDOS"
if ! grep -q '^ALERTA_WEBHOOK_URL=' "$DIR/../.env" 2>/dev/null; then
  echo "Aviso: no configuraste ALERTA_WEBHOOK_URL; la salud fallará sin aviso externo." >&2
fi
echo "Listo. Revisa el estado con: systemctl status clasesespejo-salud.timer"
