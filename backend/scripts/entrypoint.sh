#!/bin/sh
# Arranque del contenedor: aplica migraciones y arranca Nest.
# No siembra datos de demostración: una base nueva queda vacía y la presidencia
# se crea con PRESIDENTE_CORREO al arrancar la aplicación.
set -eu

cd /app/backend
mkdir -p uploads respaldos

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL. Define la conexión de PostgreSQL en .env.docker." >&2
  exit 1
fi

echo "Aplicando migraciones de Prisma..."
intentos=0
until ./node_modules/.bin/prisma migrate deploy; do
  intentos=$((intentos + 1))
  if [ "$intentos" -ge 30 ]; then
    echo "No se pudo conectar a la base tras 60 segundos." >&2
    exit 1
  fi
  echo "Base no disponible todavía; reintento $intentos/30..."
  sleep 2
done

echo "Arrancando la aplicación en el puerto ${PORT:-3000}..."
exec node dist/src/main.js
