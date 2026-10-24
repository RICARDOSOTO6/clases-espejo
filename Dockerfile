# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# 1) Frontend: compila Angular y deja el resultado en /app/backend/public.
#    El `outputPath` del angular.json apunta a ../backend/public.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS frontend-build

WORKDIR /app/frontend
RUN mkdir -p /app/backend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# 2) Backend: dependencias, Prisma y compilación de Nest.
#    Se instalan herramientas de compilación por si bcrypt no tiene binario
#    precompilado para la versión de Node de la imagen.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS backend-build

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# 3) Runtime: solo lo necesario para ejecutar la app.
#    Se copia node_modules completo porque el entrypoint usa el CLI de Prisma
#    (`prisma migrate deploy`); para una imagen más pequeña habría que separar
#    el CLI de las dependencias de ejecución.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/generated ./generated
COPY --from=backend-build /app/backend/prisma ./prisma
COPY --from=backend-build /app/backend/plantillas ./plantillas
COPY --from=backend-build /app/backend/package.json ./package.json
COPY --from=frontend-build /app/backend/public ./public
COPY backend/scripts/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
  && mkdir -p uploads respaldos \
  && chown -R node:node /app/backend

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
