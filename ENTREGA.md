# Entrega funcional — Clases Conjuntas

Versión de entrega: **2026-10-27**

Este paquete contiene el código fuente, las migraciones y el frontend ya
compilado. **No contiene** `node_modules`, `.env`, archivos subidos, base de
datos ni credenciales.

## Qué incluye

| Ruta | Contenido |
|---|---|
| `backend/` | API NestJS, esquema y migraciones de Prisma |
| `frontend/` | Aplicación Angular |
| `backend/public/` | Frontend compilado que sirve la API |
| `backend/dist/` | API compilada (requiere dependencias y Prisma generado) |
| `docker-compose.yml`, `Dockerfile` | Despliegue con PostgreSQL |
| `docs/` | Guías, manual y plan por fases |
| `ENTREGA.md` | Este documento |

## Requisitos

- Node.js **24** (o versión compatible con `package.json`).
- PostgreSQL **17**.
- Para Docker: Docker Desktop o Docker Engine con Compose.

## Instalación local

```powershell
# 1. Dependencias
cd backend
npm ci
cd ..\frontend
npm ci

# 2. Variables de entorno (copiar y completar)
cd ..\backend
Copy-Item .env.example .env
# Editar DATABASE_URL, JWT_SECRET, correo y URL_PUBLICA

# 3. Base de datos
npx prisma generate
npx prisma migrate deploy

# 4. Frontend compilado (si se cambió el cliente)
cd ..\frontend
npx ng build
cd ..\backend

# 5. Arranque
node dist/src/main.js
```

La aplicación queda en `http://localhost:3000`.

### Base vacía

En una base nueva, la presidencia se crea con `PRESIDENTE_CORREO` y recibe una
contraseña provisional por correo. Si el correo no está configurado, la
contraseña se escribe en el log solo para la puesta en marcha inicial. **No
incluyas credenciales ni el `.env` en una entrega pública.**

Para emitir certificados en una base vacía hace falta crear primero una
plantilla desde el panel de la CACE.

## Docker

```powershell
Copy-Item .env.docker.example .env.docker
# Completar .env.docker sin subirlo al repositorio
docker compose up -d --build
```

La imagen **no se construyó en esta máquina** porque Docker no está instalado.
El `Dockerfile` y el `docker-compose.yml` están incluidos, pero la construcción
debe validarse en el servidor.

## Pruebas incluidas en el desarrollo

- **146 pruebas e2e** contra una base de prueba aislada, incluidas las de
  secretaría de institución, invitación de agente y panel de desempeño.
- **39 pruebas unitarias**.
- `tsc`, `eslint`, `ngc` y builds correctos.
- Las cuentas anteriores a la versión vigente del aviso quedan detenidas en
  `/aceptar-aviso` hasta que lo acepten.
- Panel de desempeño inicial por institución (CACE) y por docente (agente), con
  barras y tabla de métricas.
- Los certificados llevan marca **DEMO** y se pueden desactivar con
  `CERTIFICADO_MODO_DEMO=false`.

Para repetirlas:

```powershell
cd backend
npm run test
npm run test:e2e
```

Las pruebas e2e requieren una base cuyo nombre termine en `_test` o `_ci`.

## Pendiente antes de producción

- Validar el **piloto real con participantes desconocidos**: registro sobre la
  marcha, aprobación en vivo, invitación/activación y URL sin dominio estable.
- Probar la secretaría de institución con una persona real: enlace copiable,
  alta, contacto y docentes; y confirmar que no accede a clases ni certificados.
- Contratar/validar URL pública y HTTPS.
- Autorizar proveedor de correo real.
- Validar respaldo y restauración en el servidor.
- Revisar el aviso de privacidad con la CACE.
- Crear cuentas reales y plantilla DEMO en la base de producción.
- Si se autoriza: TOTP para presidencia y secretaría.

La lista detallada está en `docs/producto/plan-de-fases-pendientes.md` y el
plan local-first en `docs/producto/plan-de-trabajo-antes-del-servidor.md`.
